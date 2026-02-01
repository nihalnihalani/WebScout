import { z } from "zod";
import { createStagehand, closeStagehand, getSessionDebugUrl } from "../browser/stagehand-client";
import {
  searchSimilarPatterns,
  storePattern,
  incrementPatternFailure,
  updatePatternLastSuccess,
  ensureVectorIndex,
} from "../redis/vectors";
import { computePatternFitness, computeCompositeScore } from "./pattern-fitness";
import { attemptRecovery } from "./recovery";
import { buildPattern, isConfidentMatch, getConfidenceThreshold, adjustConfidenceThreshold } from "./pattern-extractor";
import { extractUrlPattern } from "../utils/url";
import { initWeave, createTracedOp, createInvocableOp, withWeaveAttributes, savePatternDataset } from "../tracing/weave";
import { captureScreenshot, captureDOMSnapshot } from "../tracing/trace-context";
import { initOpenAITracing } from "../embeddings/openai";
import { listPatterns } from "../redis/patterns";
import { updateTaskProgress } from "../redis/tasks";
import { geminiAnalyzePage, isGeminiAvailable } from "../ai/gemini";
import { assessExtractionQuality } from "../ai/openai-quality";
import { logTaskAsEvalPrediction } from "../evaluation/weave-eval-logger";
import type { TaskRequest, TaskResult, TaskStep } from "../utils/types";

/**
 * The core learning scrape function — THE HEART of WebScout.
 *
 * Algorithm:
 * 1. Search Redis for cached patterns (vector KNN)
 * 2. Launch cloud browser, navigate to URL
 * 3. If cache hit -> try cached extraction
 * 4. If no cache / cache failed -> fresh extraction
 * 5. If fresh failed -> RECOVERY (agent, act, refined) -> LEARN
 * 6. Every step: traced with Weave, screenshotted, logged
 */
export const learningScrape = createInvocableOp(
  "learningScrape",
  async function learningScrape(task: TaskRequest): Promise<TaskResult> {
    await initWeave();
    await initOpenAITracing();
    await ensureVectorIndex();

    const steps: TaskStep[] = [];
    const screenshots: string[] = [];
    const taskId = task.id || crypto.randomUUID();
    const urlPattern = extractUrlPattern(task.url);
    const startTime = Date.now();

    let patternId: string | undefined;
    let sessionUrl: string | undefined;

    // Flush progress to Redis so the SSE live view can pick up intermediate steps
    const flushProgress = () => {
      updateTaskProgress(taskId, { steps, screenshots, session_url: sessionUrl }).catch(() => {});
    };

    // Fetch dynamic confidence threshold
    let confidenceThreshold: number;
    try {
      confidenceThreshold = await getConfidenceThreshold();
    } catch {
      confidenceThreshold = 0.85;
    }

    // Wrap the entire scrape with Weave attributes for rich filtering
    return withWeaveAttributes(
      {
        taskId,
        urlPattern,
        target: task.target,
        sessionType: "learning_scrape",
      },
      async () => {
        // STEP 1: Search Redis for known patterns

        steps.push({
          action: "vector_search",
          status: "info",
          detail: `Searching Redis for patterns matching: "${urlPattern} ${task.target}"`,
          timestamp: Date.now(),
        });

        let cachedPatterns: Awaited<ReturnType<typeof searchSimilarPatterns>> = [];
        try {
          const queryText = `${urlPattern} ${task.target}`;
          cachedPatterns = await searchSimilarPatterns(queryText, 10);
        } catch (error) {
          console.warn("[Scraper] Redis search failed, proceeding without cache:", error);
          steps.push({
            action: "cache_error",
            status: "info",
            detail: "Redis unavailable — proceeding without cache",
            timestamp: Date.now(),
          });
        }
        flushProgress();

        // Re-rank by composite score: vector similarity * 0.6 + pattern fitness * 0.4
        let bestMatch = null;
        if (cachedPatterns.length > 0) {
          const ranked = cachedPatterns
            .map(p => {
              const fitness = computePatternFitness(p);
              return {
                ...p,
                fitness,
                compositeScore: computeCompositeScore(p.score ?? 0, fitness),
              };
            })
            .filter(p => p.fitness >= 0.2) // Filter out unreliable patterns
            .sort((a, b) => b.compositeScore - a.compositeScore);

          if (ranked.length > 0 && ranked[0].score !== undefined) {
            bestMatch = ranked[0];
          }
        }

        if (bestMatch && isConfidentMatch(bestMatch.compositeScore ?? bestMatch.score!, confidenceThreshold)) {
          steps.push({
            action: "cache_hit",
            status: "success",
            detail: `Found cached pattern (${(bestMatch.score! * 100).toFixed(1)}% match, composite=${((bestMatch.compositeScore ?? bestMatch.score!) * 100).toFixed(1)}%, threshold=${(confidenceThreshold * 100).toFixed(1)}%): "${bestMatch.working_selector.substring(0, 80)}..."`,
            timestamp: Date.now(),
          });
          flushProgress();
        } else {
          steps.push({
            action: "cache_miss",
            status: "info",
            detail: cachedPatterns.length > 0
              ? bestMatch
                ? `Best composite score ${((bestMatch.compositeScore ?? bestMatch.score!) * 100).toFixed(1)}% (vector=${(bestMatch.score! * 100).toFixed(1)}%, fitness=${(bestMatch.fitness * 100).toFixed(1)}%) — below ${(confidenceThreshold * 100).toFixed(1)}% threshold`
                : `${cachedPatterns.length} pattern(s) found but filtered by low fitness — best vector score ${((cachedPatterns[0]?.score || 0) * 100).toFixed(1)}%`
              : "No patterns found in Redis",
            timestamp: Date.now(),
          });
          flushProgress();
        }

        // STEP 2: Launch browser and navigate

        steps.push({
          action: "browser_init",
          status: "info",
          detail: "Launching cloud browser via Browserbase + Stagehand",
          timestamp: Date.now(),
        });

        const stagehand = await createStagehand();
        sessionUrl = getSessionDebugUrl(stagehand);
        const page = stagehand.context.pages()[0];

        if (sessionUrl) {
          steps.push({
            action: "session_live",
            status: "info",
            detail: `Browserbase live session: ${sessionUrl}`,
            timestamp: Date.now(),
          });
          flushProgress();
        }

        try {
          await page.goto(task.url, { waitUntil: "domcontentloaded", timeoutMs: 30000 });
          await page.waitForTimeout(2000);

          const initialScreenshot = await captureScreenshot(page);
          screenshots.push(initialScreenshot);
          steps.push({
            action: "navigate",
            status: "success",
            detail: `Navigated to ${task.url}`,
            screenshot: initialScreenshot,
            timestamp: Date.now(),
          });
          flushProgress();

          // STEP 3: Try cached pattern (if confident match)

          if (bestMatch && isConfidentMatch(bestMatch.compositeScore ?? bestMatch.score!, confidenceThreshold)) {
            try {
              steps.push({
                action: "cached_extract",
                status: "info",
                detail: `Trying cached selector: "${bestMatch.working_selector.substring(0, 80)}..."`,
                timestamp: Date.now(),
              });

              const cachedSchema = z.object({
                data: z.string().describe(`The extracted information for: ${bestMatch.working_selector}`),
              });
              const result = await stagehand.extract(bestMatch.working_selector, cachedSchema);

              if (result && result.data && result.data.length > 0) {
                let parsedResult: unknown = result.data;
                try {
                  parsedResult = JSON.parse(result.data);
                } catch {
                  // Keep as string
                }

                await updatePatternLastSuccess(bestMatch.id);
                await adjustConfidenceThreshold(true).catch(console.warn);

                const ss = await captureScreenshot(page);
                screenshots.push(ss);
                steps.push({
                  action: "cached_extract",
                  status: "success",
                  detail: "Cached pattern worked! Success count incremented.",
                  screenshot: ss,
                  timestamp: Date.now(),
                });
                flushProgress();

                // Quality check (non-critical)
                let qualityScore: number | undefined;
                let qualitySummary: string | undefined;
                try {
                  const qa = await assessExtractionQuality(task.target, parsedResult, task.url);
                  qualityScore = qa.quality_score;
                  qualitySummary = qa.summary;
                  steps.push({
                    action: "quality_check",
                    status: qa.quality_score >= 50 ? "success" : "info",
                    detail: `Quality: ${qa.quality_score}/100 (${qa.confidence}) — ${qa.summary}`,
                    timestamp: Date.now(),
                  });
                } catch (qErr) {
                  steps.push({
                    action: "quality_check",
                    status: "info",
                    detail: `Quality check skipped: ${(qErr as Error).message}`,
                    timestamp: Date.now(),
                  });
                }

                const taskResult = buildResult(taskId, task, "success", parsedResult, steps, screenshots, true, false, bestMatch.id, startTime, sessionUrl);
                taskResult.quality_score = qualityScore;
                taskResult.quality_summary = qualitySummary;

                // Log evaluation prediction (non-critical)
                logTaskAsEvalPrediction({
                  taskId,
                  url: task.url,
                  target: task.target,
                  status: "success",
                  durationMs: Date.now() - startTime,
                  usedCache: true,
                  recoveryAttempted: false,
                  qualityScore: qualityScore ?? 0,
                }).catch(() => {});

                return taskResult;
              }
            } catch (error) {
              await incrementPatternFailure(bestMatch.id).catch(console.warn);
              await adjustConfidenceThreshold(false).catch(console.warn);
              steps.push({
                action: "cached_extract",
                status: "failure",
                detail: `Cached pattern failed: ${(error as Error).message}`,
                timestamp: Date.now(),
              });
              flushProgress();
            }
          }

          // STEP 3.5: Gemini pre-analysis (if available)

          let geminiInstruction: string | undefined;

          if (isGeminiAvailable()) {
            try {
              steps.push({
                action: "gemini_preanalysis",
                status: "info",
                detail: "Asking Gemini to pre-analyse the page DOM for optimal extraction strategy...",
                timestamp: Date.now(),
              });

              const domSnippet = await captureDOMSnapshot(page);
              const analysis = await geminiAnalyzePage(task.url, task.target, domSnippet);

              // Use the first suggested selector (if any) or the extraction strategy as a hint
              geminiInstruction =
                analysis.suggestedSelectors.length > 0
                  ? analysis.suggestedSelectors[0]
                  : analysis.extractionStrategy;

              steps.push({
                action: "gemini_preanalysis",
                status: "success",
                detail: `Gemini recommends strategy "${analysis.extractionStrategy}" with ${analysis.suggestedSelectors.length} selector(s). Reasoning: ${analysis.reasoning}`,
                timestamp: Date.now(),
              });
              flushProgress();
            } catch (error) {
              steps.push({
                action: "gemini_preanalysis",
                status: "failure",
                detail: `Gemini pre-analysis failed (non-fatal): ${(error as Error).message}`,
                timestamp: Date.now(),
              });
              flushProgress();
            }
          }

          // STEP 4: Fresh extraction attempt

          const extractionTarget = geminiInstruction
            ? `${task.target} (hint: use selector "${geminiInstruction}")`
            : task.target;

          try {
            steps.push({
              action: "fresh_extract",
              status: "info",
              detail: geminiInstruction
                ? `Fresh extraction with Gemini hint: "${extractionTarget}"`
                : `Fresh extraction: "${task.target}"`,
              timestamp: Date.now(),
            });

            const freshSchema = z.object({
              data: z.string().describe(`The extracted information for: ${extractionTarget}`),
            });
            const result = await stagehand.extract(extractionTarget, freshSchema);

            if (result && result.data && result.data.length > 0) {
              // Try to parse as JSON if possible, otherwise keep as string
              let parsedResult: unknown = result.data;
              try {
                parsedResult = JSON.parse(result.data);
              } catch {
                // Keep as string
              }

              const pattern = buildPattern(task.url, task.target, task.target, "extract");
              patternId = await storePattern(pattern);

              // Save updated patterns to Weave Dataset
              try {
                const { patterns } = await listPatterns(100, 0);
                await savePatternDataset(patterns);
              } catch {
                // Non-critical
              }

              const ss = await captureScreenshot(page);
              screenshots.push(ss);
              steps.push({
                action: "fresh_extract",
                status: "success",
                detail: "Fresh extraction succeeded! Pattern stored for future use.",
                screenshot: ss,
                timestamp: Date.now(),
              });
              steps.push({
                action: "pattern_stored",
                status: "success",
                detail: `New pattern stored: ${patternId}`,
                timestamp: Date.now(),
              });
              flushProgress();

              // Quality check (non-critical)
              let qualityScore: number | undefined;
              let qualitySummary: string | undefined;
              try {
                const qa = await assessExtractionQuality(task.target, parsedResult, task.url);
                qualityScore = qa.quality_score;
                qualitySummary = qa.summary;
                steps.push({
                  action: "quality_check",
                  status: qa.quality_score >= 50 ? "success" : "info",
                  detail: `Quality: ${qa.quality_score}/100 (${qa.confidence}) — ${qa.summary}`,
                  timestamp: Date.now(),
                });
                flushProgress();
              } catch (qErr) {
                steps.push({
                  action: "quality_check",
                  status: "info",
                  detail: `Quality check skipped: ${(qErr as Error).message}`,
                  timestamp: Date.now(),
                });
              }

              const taskResult = buildResult(taskId, task, "success", parsedResult, steps, screenshots, false, false, patternId, startTime, sessionUrl);
              taskResult.quality_score = qualityScore;
              taskResult.quality_summary = qualitySummary;

              // Log evaluation prediction (non-critical)
              logTaskAsEvalPrediction({
                taskId,
                url: task.url,
                target: task.target,
                status: "success",
                durationMs: Date.now() - startTime,
                usedCache: false,
                recoveryAttempted: false,
                qualityScore: qualityScore ?? 0,
              }).catch(() => {});

              return taskResult;
            }
          } catch (error) {
            const ss = await captureScreenshot(page);
            screenshots.push(ss);
            steps.push({
              action: "fresh_extract",
              status: "failure",
              detail: `Fresh extraction failed: ${(error as Error).message}`,
              screenshot: ss,
              timestamp: Date.now(),
            });
            flushProgress();
          }

          // STEP 5: RECOVERY — THE LEARNING STEP

          steps.push({
            action: "recovery_start",
            status: "recovery",
            detail: "Starting multi-strategy recovery...",
            timestamp: Date.now(),
          });
          flushProgress();

          const recoveryResult = await attemptRecovery(
            stagehand,
            page,
            task,
            `Extraction of "${task.target}" failed on ${urlPattern}`
          );

          if (recoveryResult && recoveryResult.success) {
            // LEARNED SOMETHING NEW!
            const approach = recoveryResult.strategy_used === "extract_refined"
              ? "extract" as const
              : recoveryResult.strategy_used as "act" | "agent";
            const pattern = buildPattern(task.url, task.target, recoveryResult.working_selector, approach);
            patternId = await storePattern(pattern);

            // Save updated patterns to Weave Dataset
            try {
              const { patterns } = await listPatterns(100, 0);
              await savePatternDataset(patterns);
            } catch {
              // Non-critical
            }

            const ss = recoveryResult.screenshot || await captureScreenshot(page);
            screenshots.push(ss);

            steps.push({
              action: "recovery_success",
              status: "success",
              detail: `Recovery succeeded via "${recoveryResult.strategy_used}". Pattern learned!`,
              screenshot: ss,
              timestamp: Date.now(),
            });
            steps.push({
              action: "pattern_learned",
              status: "success",
              detail: `Learned new pattern: ${patternId}`,
              timestamp: Date.now(),
            });
            flushProgress();

            // Quality check (non-critical)
            let qualityScore: number | undefined;
            let qualitySummary: string | undefined;
            try {
              const qa = await assessExtractionQuality(task.target, recoveryResult.result, task.url);
              qualityScore = qa.quality_score;
              qualitySummary = qa.summary;
              steps.push({
                action: "quality_check",
                status: qa.quality_score >= 50 ? "success" : "info",
                detail: `Quality: ${qa.quality_score}/100 (${qa.confidence}) — ${qa.summary}`,
                timestamp: Date.now(),
              });
              flushProgress();
            } catch (qErr) {
              steps.push({
                action: "quality_check",
                status: "info",
                detail: `Quality check skipped: ${(qErr as Error).message}`,
                timestamp: Date.now(),
              });
            }

            const taskResult = buildResult(taskId, task, "success", recoveryResult.result, steps, screenshots, false, true, patternId, startTime, sessionUrl);
            taskResult.quality_score = qualityScore;
            taskResult.quality_summary = qualitySummary;

            // Log evaluation prediction (non-critical)
            logTaskAsEvalPrediction({
              taskId,
              url: task.url,
              target: task.target,
              status: "success",
              durationMs: Date.now() - startTime,
              usedCache: false,
              recoveryAttempted: true,
              qualityScore: qualityScore ?? 0,
            }).catch(() => {});

            return taskResult;
          }

          // ALL STRATEGIES FAILED

          const domSnapshot = await captureDOMSnapshot(page);
          steps.push({
            action: "recovery_failed",
            status: "failure",
            detail: "All recovery strategies exhausted. Task failed.",
            dom_snapshot: domSnapshot,
            timestamp: Date.now(),
          });
          flushProgress();

          // Log evaluation prediction (non-critical)
          logTaskAsEvalPrediction({
            taskId,
            url: task.url,
            target: task.target,
            status: "failed",
            durationMs: Date.now() - startTime,
            usedCache: false,
            recoveryAttempted: true,
            qualityScore: 0,
          }).catch(() => {});

          return buildResult(taskId, task, "failed", null, steps, screenshots, false, true, undefined, startTime, sessionUrl);

        } finally {
          await closeStagehand(stagehand);
        }
      }
    );
  },
  {
    // Custom Weave summary — these metrics show up in the Weave UI
    summarize: (result: TaskResult) => ({
      "webscout.success": result.status === "success" ? 1 : 0,
      "webscout.used_cache": result.used_cached_pattern ? 1 : 0,
      "webscout.recovery_attempted": result.recovery_attempted ? 1 : 0,
      "webscout.recovery_succeeded": (result.recovery_attempted && result.status === "success") ? 1 : 0,
      "webscout.pattern_learned": result.pattern_id ? 1 : 0,
      "webscout.quality_score": result.quality_score ?? -1,
      "webscout.duration_ms": (result.completed_at || Date.now()) - result.created_at,
      "webscout.steps_count": result.steps.length,
    }),
    callDisplayName: (task: TaskRequest) => {
      try {
        const host = new URL(task.url).hostname;
        return `scrape:${host}/${task.target.substring(0, 30)}`;
      } catch {
        return `scrape:${task.target.substring(0, 40)}`;
      }
    },
  }
);

// Helper: Build TaskResult
// NOTE: Steps are stripped of large base64 data to prevent Weave serialization
// stack overflow. The full step data is already flushed to Redis via flushProgress().

function buildResult(
  id: string,
  task: TaskRequest,
  status: "success" | "failed",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
  steps: TaskStep[],
  screenshots: string[],
  usedCachedPattern: boolean,
  recoveryAttempted: boolean,
  patternId: string | undefined,
  startTime: number,
  sessionUrl?: string
): TaskResult {
  // Strip large base64 data from steps to prevent Weave serialization overflow.
  // The complete step data is already in Redis from flushProgress() calls.
  const safeSteps = steps.map(step => {
    const s = { ...step };
    if (s.screenshot) s.screenshot = "[captured]";
    if (s.dom_snapshot) s.dom_snapshot = s.dom_snapshot.substring(0, 500) + "...";
    return s;
  });

  // Keep only the last 3 screenshots in the top-level array (for Weave trace display)
  const safeScreenshots = screenshots.slice(-3).map(s =>
    s.length > 50000 ? s.substring(0, 50000) : s
  );

  return {
    id,
    url: task.url,
    target: task.target,
    status,
    result,
    used_cached_pattern: usedCachedPattern,
    recovery_attempted: recoveryAttempted,
    pattern_id: patternId,
    session_url: sessionUrl,
    screenshots: safeScreenshots,
    steps: safeSteps,
    created_at: startTime,
    completed_at: Date.now(),
  };
}
