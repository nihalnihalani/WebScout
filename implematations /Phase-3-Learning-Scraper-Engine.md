# Phase 3: Core Engine — The Learning Scraper

## Phase Overview

**Goal:** Build the heart of WebScout — the learning scrape loop that checks cache, extracts data, recovers from failures, and stores patterns.

**Dependencies:** Phase 2 complete (Redis vectors, embeddings, Weave, types)

**Produces:**
- Browserbase session management
- Stagehand client factory
- Pattern extractor utilities
- Multi-strategy recovery engine (agent, act, refined extract)
- Core `learningScrape()` function — the complete learning loop

---

## Architecture: The Learning Loop

```
learningScrape(url, target)
        │
        ▼
┌─────────────────┐
│ 1. Vector Search │──→ Search Redis for similar past patterns
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ 2. Cache Hit?    │─Yes─│ Try cached pattern│──Success──→ Return + increment count
└────────┬────────┘     └────────┬─────────┘
         │ No                    │ Fail
         ▼                       ▼
┌─────────────────┐
│ 3. Fresh Extract │──Success──→ Store pattern + Return
└────────┬────────┘
         │ Fail
         ▼
┌─────────────────┐     ┌──────────────────┐
│ 4. RECOVERY      │────►│ Strategy A: Agent │
│    (Learning!)   │     │ Strategy B: Act   │
│                  │     │ Strategy C: Refine│
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
    Success?──Yes──→ Store NEW pattern + Return (LEARNED!)
         │
         No──→ Return failure with all trace data
```

---

## Step 3.1: Browserbase Session Management

**File: `src/lib/browser/session.ts`**

```typescript
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

/**
 * Create a new Browserbase cloud browser session.
 */
export async function createBrowserSession() {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  console.log(`[Browserbase] Session created: ${session.id}`);
  return session;
}

/**
 * Get the debug URL for a session (for live viewing).
 */
export function getSessionDebugUrl(sessionId: string): string {
  return `https://www.browserbase.com/sessions/${sessionId}`;
}
```

---

## Step 3.2: Stagehand Client Factory

**File: `src/lib/browser/stagehand-client.ts`**

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

/**
 * Create and initialize a Stagehand instance backed by Browserbase.
 *
 * Stagehand API:
 * - stagehand.context.pages()[0] → Playwright Page
 * - stagehand.extract(instruction, schema) → typed data
 * - stagehand.act(instruction) → { success, message, actions }
 * - stagehand.agent({...}).execute(task) → { success, message }
 * - stagehand.close() → cleanup
 */
export async function createStagehand(): Promise<Stagehand> {
  try {
    const stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      model: "openai/gpt-4o",
    });

    await stagehand.init();
    console.log("[Stagehand] Initialized with Browserbase");
    return stagehand;
  } catch (error) {
    throw new Error(
      `Stagehand init failed. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID. ` +
      `Error: ${(error as Error).message}`
    );
  }
}

export async function closeStagehand(stagehand: Stagehand): Promise<void> {
  try {
    await stagehand.close();
    console.log("[Stagehand] Session closed");
  } catch (error) {
    console.warn("[Stagehand] Close error:", (error as Error).message);
  }
}
```

---

## Step 3.3: Pattern Extractor Utilities

**File: `src/lib/engine/pattern-extractor.ts`**

```typescript
import type { PatternData } from "../utils/types";
import { extractUrlPattern } from "../utils/url";

export function buildPattern(
  url: string,
  target: string,
  workingSelector: string,
  approach: "extract" | "act" | "agent"
): PatternData {
  return {
    url_pattern: extractUrlPattern(url),
    target,
    working_selector: workingSelector,
    approach,
  };
}

/** Threshold: 85% similarity = confident match */
export function isConfidentMatch(score: number): boolean {
  return score >= 0.85;
}

export function buildRefinedInstruction(
  originalTarget: string,
  failureContext: string
): string {
  return (
    `Previous attempt to extract "${originalTarget}" failed. ` +
    `Context: ${failureContext}. ` +
    `Look more carefully: main content, sidebars, tables, product details, ` +
    `pricing sections, metadata. Extract: ${originalTarget}`
  );
}
```

---

## Step 3.4: Multi-Strategy Recovery Engine

**File: `src/lib/engine/recovery.ts`**

```typescript
import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";
import type { RecoveryResult, TaskRequest } from "../utils/types";
import { captureScreenshot } from "../tracing/trace-context";
import { createTracedOp } from "../tracing/weave";
import { z } from "zod";

/**
 * Attempt recovery from a failed extraction using 3 strategies:
 *   A) Agent-based: autonomous navigation + extraction
 *   B) Act-based: dismiss blockers (cookies, modals), then re-extract
 *   C) Refined: more verbose extraction instruction
 *
 * Returns the first successful result, or null if all fail.
 */
export const attemptRecovery = createTracedOp(
  "attemptRecovery",
  async function attemptRecovery(
    stagehand: Stagehand,
    page: Page,
    task: TaskRequest,
    failureContext: string
  ): Promise<RecoveryResult | null> {
    console.log("[Recovery] Starting multi-strategy recovery...");

    // ── Strategy A: Agent ──
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
          strategy_used: "agent",
          working_selector: `agent: find ${task.target}`,
          screenshot,
        };
      }
    } catch (error) {
      console.warn("[Recovery] Strategy A failed:", (error as Error).message);
    }

    // ── Strategy B: Remove Blockers + Re-extract ──
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

      // Retry extraction after removing blockers
      const result = await stagehand.extract({
        instruction: task.target,
        schema: z.object({ data: z.any() }),
      });

      if (result && result.data) {
        const screenshot = await captureScreenshot(page);
        return {
          success: true,
          result: result.data,
          strategy_used: "act",
          working_selector: `act: remove blockers then extract ${task.target}`,
          screenshot,
        };
      }
    } catch (error) {
      console.warn("[Recovery] Strategy B failed:", (error as Error).message);
    }

    // ── Strategy C: Refined Extract ──
    try {
      console.log("[Recovery] Strategy C: Refined instruction");
      const refinedInstruction =
        `Previous extraction failed (${failureContext}). ` +
        `Look more carefully for "${task.target}" on this page. ` +
        `Check: main content, sidebars, tables, headers, product details, ` +
        `pricing sections, metadata, and dynamically loaded content.`;

      const result = await stagehand.extract({
        instruction: refinedInstruction,
        schema: z.object({ data: z.any() }),
      });

      if (result && result.data) {
        return {
          success: true,
          result: result.data,
          strategy_used: "extract_refined",
          working_selector: refinedInstruction,
        };
      }
    } catch (error) {
      console.warn("[Recovery] Strategy C failed:", (error as Error).message);
    }

    console.log("[Recovery] All strategies exhausted");
    return null;
  }
);
```

---

## Step 3.5: Core Learning Scraper (THE HEART OF WEBSCOUT)

**File: `src/lib/engine/scraper.ts`**

```typescript
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
 * 3. If cache hit → try cached extraction
 * 4. If no cache / cache failed → fresh extraction
 * 5. If fresh failed → RECOVERY (agent, act, refined) → LEARN
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

    let usedCachedPattern = false;
    let recoveryAttempted = false;
    let patternId: string | undefined;

    // ══════════════════════════════════════════════════
    // STEP 1: Search Redis for known patterns
    // ══════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════
    // STEP 2: Launch browser and navigate
    // ══════════════════════════════════════════════════

    steps.push({
      action: "browser_init",
      status: "info",
      detail: "Launching cloud browser via Browserbase + Stagehand",
      timestamp: Date.now(),
    });

    const stagehand = await createStagehand();
    const page = stagehand.context.pages()[0];

    try {
      await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 30000 });
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

      // ══════════════════════════════════════════════════
      // STEP 3: Try cached pattern (if confident match)
      // ══════════════════════════════════════════════════

      if (bestMatch && isConfidentMatch(bestMatch.score!)) {
        try {
          steps.push({
            action: "cached_extract",
            status: "info",
            detail: `Trying cached selector: "${bestMatch.working_selector.substring(0, 80)}..."`,
            timestamp: Date.now(),
          });

          const result = await stagehand.extract({
            instruction: bestMatch.working_selector,
            schema: z.object({ data: z.any() }),
          });

          if (result && result.data) {
            usedCachedPattern = true;
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

      // ══════════════════════════════════════════════════
      // STEP 4: Fresh extraction attempt
      // ══════════════════════════════════════════════════

      try {
        steps.push({
          action: "fresh_extract",
          status: "info",
          detail: `Fresh extraction: "${task.target}"`,
          timestamp: Date.now(),
        });

        const result = await stagehand.extract({
          instruction: task.target,
          schema: z.object({ data: z.any() }),
        });

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

      // ══════════════════════════════════════════════════
      // STEP 5: RECOVERY — THE LEARNING STEP
      // ══════════════════════════════════════════════════

      recoveryAttempted = true;
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

      // ══════════════════════════════════════════════════
      // ALL STRATEGIES FAILED
      // ══════════════════════════════════════════════════

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

// ── Helper: Build TaskResult ──

function buildResult(
  id: string,
  task: TaskRequest,
  status: "success" | "failed",
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
```

---

## Step 3.6: Testing & Debugging

### Manual Test

After Phase 4 (API routes) is complete, test with:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html","target":"book title and price"}'
```

### Test URLs

| URL | Target | Expected Behavior |
|-----|--------|-------------------|
| `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html` | "book title and price" | Fresh extract succeeds, stores pattern |
| Same URL again | Same target | Cache hit, uses stored pattern |
| `https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html` | "book title and price" | Cache hit (same URL pattern: `books.toscrape.com/catalogue/*`) |
| `https://quotes.toscrape.com/` | "first quote and author" | Fresh extract succeeds, new pattern |
| `https://example.com` | "main heading text" | Fresh extract succeeds |

### Common Errors

| Error | Fix |
|-------|-----|
| Browserbase session creation failed | Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID |
| Stagehand timeout on init | Check network connectivity, try again |
| extract() returns undefined | The page may not have loaded — increase waitForTimeout |
| agent().execute() hangs | Set maxSteps in agent config |
| Recovery loops forever | Each strategy has its own timeout |

### Debug Checklist

- [ ] `createStagehand()` initializes without error
- [ ] Page navigation works (goto + screenshot)
- [ ] `stagehand.extract()` returns data for simple pages
- [ ] `stagehand.act()` can click buttons
- [ ] `stagehand.agent().execute()` can perform multi-step tasks
- [ ] Pattern stored in Redis after successful extraction
- [ ] Second run with similar URL hits cache
- [ ] Weave traces appear in W&B dashboard
- [ ] Screenshots captured as base64 strings

---

## Step 3.7: GitHub Workflow

**File: `.github/workflows/phase-3-engine.yml`**

```yaml
name: Phase 3 - Engine Build Verification

on: [push, pull_request]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    services:
      redis:
        image: redis/redis-stack:latest
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      REDIS_URL: redis://localhost:6379
      OPENAI_API_KEY: ci_placeholder
      BROWSERBASE_API_KEY: ci_placeholder
      BROWSERBASE_PROJECT_ID: ci_placeholder
      WANDB_API_KEY: ci_placeholder
      WEAVE_PROJECT: webscout-ci

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: webscout/package-lock.json

      - run: cd webscout && npm ci
      - run: cd webscout && npx tsc --noEmit
      - run: cd webscout && npm run build
```

---

## File Checklist

| File | Description |
|------|-------------|
| `src/lib/browser/session.ts` | Browserbase session management |
| `src/lib/browser/stagehand-client.ts` | Stagehand factory + cleanup |
| `src/lib/engine/pattern-extractor.ts` | buildPattern, isConfidentMatch |
| `src/lib/engine/recovery.ts` | 3-strategy recovery (agent, act, refined) |
| `src/lib/engine/scraper.ts` | Core learningScrape() — THE HEART |
| `.github/workflows/phase-3-engine.yml` | CI workflow |

**Total: 6 new files**

---

**Phase 3 Complete.** The learning engine is built. **Next: Phase 4 — API Routes.**
