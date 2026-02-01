import { z } from "zod";
import { createStagehand, closeStagehand } from "../browser/stagehand-client";
import {
  searchSimilarPatterns,
  storePattern,
  incrementPatternSuccess,
  ensureVectorIndex,
} from "../redis/vectors";
import { attemptRecovery } from "./recovery";
import { buildPattern, isConfidentMatch } from "./pattern-extractor";
import { extractUrlPattern } from "../utils/url";
import { initWeave, createTracedOp } from "../tracing/weave";
import { captureScreenshot, captureDOMSnapshot } from "../tracing/trace-context";
import type { TaskRequest, TaskResult, TaskStep } from "../utils/types";

/**
 * The core learning scrape function.
 *
 * Algorithm:
 * 1. Search Redis for cached patterns (vector KNN)
 * 2. Launch cloud browser, navigate to URL
 * 3. If cache hit -> try cached extraction
 * 4. If no cache / cache failed -> fresh extraction
 * 5. If fresh failed -> RECOVERY (agent, act, refined) -> LEARN
 * 6. Every step: traced, screenshotted, logged
 */
export const learningScrape = createTracedOp(
  "learningScrape",
  async function learningScrape(task: TaskRequest): Promise<TaskResult> {
    await initWeave();
    await ensureVectorIndex();

    const steps: TaskStep[] = [];
    const screenshots: string[] = [];
    const taskId = crypto.randomUUID();
    const urlPattern = extractUrlPattern(task.url);
    const startTime = Date.now();

    let patternId: string | undefined;

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
      cachedPatterns = await searchSimilarPatterns(queryText, 3);
    } catch (error) {
      console.warn("[Scraper] Redis search failed, proceeding without cache:", error);
      steps.push({
        action: "cache_error",
        status: "info",
        detail: "Redis unavailable — proceeding without cache",
        timestamp: Date.now(),
      });
    }

    const bestMatch =
      cachedPatterns.length > 0 && cachedPatterns[0].score !== undefined
        ? cachedPatterns[0]
        : null;

    if (bestMatch && isConfidentMatch(bestMatch.score!)) {
      steps.push({
        action: "cache_hit",
        status: "success",
        detail: `Found cached pattern (${(bestMatch.score! * 100).toFixed(1)}% match): "${bestMatch.working_selector.substring(0, 80)}..."`,
        timestamp: Date.now(),
      });
    } else {
      steps.push({
        action: "cache_miss",
        status: "info",
        detail: cachedPatterns.length > 0
          ? `Best match ${((cachedPatterns[0]?.score || 0) * 100).toFixed(1)}% — below 85% threshold`
          : "No patterns found in Redis",
        timestamp: Date.now(),
      });
    }

    // STEP 2: Launch browser and navigate

    steps.push({
      action: "browser_init",
      status: "info",
      detail: "Launching cloud browser via Browserbase + Stagehand",
      timestamp: Date.now(),
    });

    const stagehand = await createStagehand();
    const page = stagehand.context.pages()[0];

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

      // STEP 3: Try cached pattern (if confident match)

      if (bestMatch && isConfidentMatch(bestMatch.score!)) {
        try {
          steps.push({
            action: "cached_extract",
            status: "info",
            detail: `Trying cached selector: "${bestMatch.working_selector.substring(0, 80)}..."`,
            timestamp: Date.now(),
          });

          const result = await stagehand.extract(
            bestMatch.working_selector,
            z.object({ data: z.any() })
          );

          if (result && result.data) {
            await incrementPatternSuccess(bestMatch.id);

            const ss = await captureScreenshot(page);
            screenshots.push(ss);
            steps.push({
              action: "cached_extract",
              status: "success",
              detail: "Cached pattern worked! Success count incremented.",
              screenshot: ss,
              timestamp: Date.now(),
            });

            return buildResult(taskId, task, "success", result.data, steps, screenshots, true, false, bestMatch.id, startTime);
          }
        } catch (error) {
          steps.push({
            action: "cached_extract",
            status: "failure",
            detail: `Cached pattern failed: ${(error as Error).message}`,
            timestamp: Date.now(),
          });
        }
      }

      // STEP 4: Fresh extraction attempt

      try {
        steps.push({
          action: "fresh_extract",
          status: "info",
          detail: `Fresh extraction: "${task.target}"`,
          timestamp: Date.now(),
        });

        const result = await stagehand.extract(
          task.target,
          z.object({ data: z.any() })
        );

        if (result && result.data) {
          const pattern = buildPattern(task.url, task.target, task.target, "extract");
          patternId = await storePattern(pattern);

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

          return buildResult(taskId, task, "success", result.data, steps, screenshots, false, false, patternId, startTime);
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
      }

      // STEP 5: RECOVERY — THE LEARNING STEP

      steps.push({
        action: "recovery_start",
        status: "recovery",
        detail: "Starting multi-strategy recovery...",
        timestamp: Date.now(),
      });

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

        return buildResult(taskId, task, "success", recoveryResult.result, steps, screenshots, false, true, patternId, startTime);
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

      return buildResult(taskId, task, "failed", null, steps, screenshots, false, true, undefined, startTime);

    } finally {
      await closeStagehand(stagehand);
    }
  }
);

// Helper: Build TaskResult

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
  startTime: number
): TaskResult {
  return {
    id,
    url: task.url,
    target: task.target,
    status,
    result,
    used_cached_pattern: usedCachedPattern,
    recovery_attempted: recoveryAttempted,
    pattern_id: patternId,
    screenshots,
    steps,
    created_at: startTime,
    completed_at: Date.now(),
  };
}
