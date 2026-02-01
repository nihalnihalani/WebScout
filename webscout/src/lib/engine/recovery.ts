import type { Stagehand, Page } from "@browserbasehq/stagehand";
import type { RecoveryResult, TaskRequest } from "../utils/types";
import { captureScreenshot, captureDOMSnapshot } from "../tracing/trace-context";
import { createTracedOp, withWeaveAttributes } from "../tracing/weave";
import { isGeminiAvailable, getGeminiRecoveryStrategy } from "../ai/gemini";
import { z } from "zod";

export const attemptRecovery = createTracedOp(
  "attemptRecovery",
  async function attemptRecovery(
    stagehand: Stagehand,
    page: Page,
    task: TaskRequest,
    failureContext: string
  ): Promise<RecoveryResult | null> {
    console.log("[Recovery] Starting multi-strategy recovery...");

    return withWeaveAttributes(
      {
        recoveryFor: task.target,
        failureContext,
        strategies: ["agent", "act", "extract_refined", "gemini"],
      },
      async () => {
        // Strategy A: Agent
        try {
          console.log("[Recovery] Strategy A: Agent-based");
          const agent = stagehand.agent({
            model: "openai/gpt-4o",
          });

          const agentResult = await agent.execute(
            `You are on ${task.url}. Find and extract: "${task.target}". ` +
            `Dismiss any cookie banners or popups if needed. ` +
            `Look through the entire page to find the requested data.`
          );

          if (agentResult && agentResult.success) {
            const screenshot = await captureScreenshot(page);
            return {
              success: true,
              result: agentResult.message,
              strategy_used: "agent" as const,
              working_selector: `agent: find ${task.target}`,
              screenshot,
            };
          }
        } catch (error) {
          console.warn("[Recovery] Strategy A failed:", (error as Error).message);
        }

        // Strategy B: Remove Blockers + Re-extract
        try {
          console.log("[Recovery] Strategy B: Remove blockers");
          const blockerActions = [
            "Click any cookie consent accept/agree button if visible",
            "Close any popup or modal dialog if visible",
            "Dismiss any overlay or banner if visible",
            "Scroll down to see more content",
          ];

          for (const action of blockerActions) {
            try {
              await stagehand.act(action);
              await page.waitForTimeout(500);
            } catch {
              // Blocker not found — OK
            }
          }

          const result = await stagehand.extract(
            task.target,
            z.object({ data: z.any() })
          );

          if (result && result.data) {
            const screenshot = await captureScreenshot(page);
            return {
              success: true,
              result: result.data,
              strategy_used: "act" as const,
              working_selector: `act: remove blockers then extract ${task.target}`,
              screenshot,
            };
          }
        } catch (error) {
          console.warn("[Recovery] Strategy B failed:", (error as Error).message);
        }

        // Strategy C: Refined Extract
        try {
          console.log("[Recovery] Strategy C: Refined instruction");
          const refinedInstruction =
            `Previous extraction failed (${failureContext}). ` +
            `Look more carefully for "${task.target}" on this page. ` +
            `Check: main content, sidebars, tables, headers, product details, ` +
            `pricing sections, metadata, and dynamically loaded content.`;

          const result = await stagehand.extract(
            refinedInstruction,
            z.object({ data: z.any() })
          );

          if (result && result.data) {
            return {
              success: true,
              result: result.data,
              strategy_used: "extract_refined" as const,
              working_selector: refinedInstruction,
            };
          }
        } catch (error) {
          console.warn("[Recovery] Strategy C failed:", (error as Error).message);
        }

        // Strategy D: Gemini Analysis (Google Cloud sponsor integration)
        if (isGeminiAvailable()) {
          try {
            console.log("[Recovery] Strategy D: Gemini-powered analysis");
            const domSnippet = await captureDOMSnapshot(page);
            const geminiStrategy = await getGeminiRecoveryStrategy(
              task.url,
              task.target,
              failureContext,
              domSnippet
            );

            if (geminiStrategy.suggestedSelector) {
              const result = await stagehand.extract(
                geminiStrategy.suggestedSelector,
                z.object({ data: z.any() })
              );

              if (result && result.data) {
                const screenshot = await captureScreenshot(page);
                return {
                  success: true,
                  result: result.data,
                  strategy_used: "gemini" as const,
                  working_selector: geminiStrategy.suggestedSelector,
                  screenshot,
                };
              }
            }
          } catch (error) {
            console.warn(
              "[Recovery] Strategy D failed:",
              (error as Error).message
            );
          }
        }

        console.log("[Recovery] All strategies exhausted");
        return null;
      }
    );
  },
  {
    summarize: (result: RecoveryResult | null) => ({
      "webscout.recovery_success": result?.success ? 1 : 0,
      "webscout.recovery_strategy": result?.strategy_used || "none",
    }),
  }
);
