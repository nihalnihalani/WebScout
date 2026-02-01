import type { Stagehand, Page } from "@browserbasehq/stagehand";
import type { RecoveryResult, TaskRequest, TaskStep } from "../utils/types";
import { captureScreenshot, captureDOMSnapshot } from "../tracing/trace-context";
import { createTracedOp, withWeaveAttributes } from "../tracing/weave";
import { isGeminiAvailable, getGeminiRecoveryStrategy } from "../ai/gemini";
import { getOrderedStrategies, recordStrategyOutcome } from "./strategy-selector";
import { extractUrlPattern } from "../utils/url";
import { z } from "zod";

/**
 * Execute a single recovery strategy by name.
 * Returns a RecoveryResult on success, or null if the strategy did not produce a result.
 */
async function executeStrategy(
  strategy: string,
  stagehand: Stagehand,
  page: Page,
  task: TaskRequest,
  failureContext: string
): Promise<RecoveryResult | null> {
  switch (strategy) {
    case "agent": {
      console.log("[Recovery] Strategy: Agent-based");
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
      return null;
    }

    case "act": {
      console.log("[Recovery] Strategy: Remove blockers");
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

      const actSchema = z.object({
        data: z.string().describe(`The extracted information for: ${task.target}`),
      });
      const result = await stagehand.extract(task.target, actSchema);

      if (result && result.data && result.data.length > 0) {
        const screenshot = await captureScreenshot(page);
        return {
          success: true,
          result: result.data,
          strategy_used: "act" as const,
          working_selector: `act: remove blockers then extract ${task.target}`,
          screenshot,
        };
      }
      return null;
    }

    case "extract_refined": {
      console.log("[Recovery] Strategy: Refined instruction");
      const refinedInstruction =
        `Previous extraction failed (${failureContext}). ` +
        `Look more carefully for "${task.target}" on this page. ` +
        `Check: main content, sidebars, tables, headers, product details, ` +
        `pricing sections, metadata, and dynamically loaded content.`;

      const refinedSchema = z.object({
        data: z.string().describe(`The extracted information for: ${task.target}`),
      });
      const result = await stagehand.extract(refinedInstruction, refinedSchema);

      if (result && result.data && result.data.length > 0) {
        return {
          success: true,
          result: result.data,
          strategy_used: "extract_refined" as const,
          working_selector: refinedInstruction,
        };
      }
      return null;
    }

    case "gemini": {
      if (!isGeminiAvailable()) {
        console.log("[Recovery] Gemini not available, skipping");
        return null;
      }

      console.log("[Recovery] Strategy: Gemini-powered analysis");
      const domSnippet = await captureDOMSnapshot(page);
      const geminiStrategy = await getGeminiRecoveryStrategy(
        task.url,
        task.target,
        failureContext,
        domSnippet
      );

      if (geminiStrategy.suggestedSelector) {
        const geminiSchema = z.object({
          data: z.string().describe(`The extracted information for: ${task.target}`),
        });
        const result = await stagehand.extract(geminiStrategy.suggestedSelector, geminiSchema);

        if (result && result.data && result.data.length > 0) {
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
      return null;
    }

    default:
      console.warn(`[Recovery] Unknown strategy: ${strategy}`);
      return null;
  }
}

export const attemptRecovery = createTracedOp(
  "attemptRecovery",
  async function attemptRecovery(
    stagehand: Stagehand,
    page: Page,
    task: TaskRequest,
    failureContext: string,
    strategyOrder?: string[]
  ): Promise<RecoveryResult | null> {
    console.log("[Recovery] Starting multi-strategy recovery...");

    const urlPat = extractUrlPattern(task.url);
    const order = strategyOrder || await getOrderedStrategies(urlPat);

    const steps: TaskStep[] = [];
    steps.push({
      action: "strategy_order",
      status: "info",
      detail: `Recovery strategy order: ${order.join(" → ")}`,
      timestamp: Date.now(),
    });

    return withWeaveAttributes(
      {
        recoveryFor: task.target,
        failureContext,
        strategies: order,
        strategyOrder: order.join(" → "),
        steps,
      },
      async () => {
        for (const strategy of order) {
          const startMs = Date.now();
          try {
            const result = await executeStrategy(strategy, stagehand, page, task, failureContext);
            if (result) {
              await recordStrategyOutcome(urlPat, strategy, true, Date.now() - startMs).catch(console.warn);
              return result;
            }
          } catch (error) {
            console.warn(`[Recovery] Strategy ${strategy} failed:`, (error as Error).message);
          }
          await recordStrategyOutcome(urlPat, strategy, false, Date.now() - startMs).catch(console.warn);
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
