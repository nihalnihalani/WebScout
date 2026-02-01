<div align="center">

# WebScout

### Every failed click makes it smarter.

A self-improving browser automation agent that learns from every success and failure, getting measurably faster and more accurate over time.

This isn't a scraper with a cache bolted on — **the system literally cannot run without learning.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Weave](https://img.shields.io/badge/Weave-7_Levels_Deep-FFBE00?style=for-the-badge&logo=weightsandbiases)](https://wandb.ai/site/weave)
[![Redis](https://img.shields.io/badge/Redis-HNSW_Vector_Search-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Browserbase](https://img.shields.io/badge/Browserbase-Cloud_Browser-4A154B?style=for-the-badge)](https://www.browserbase.com/)
[![Stagehand](https://img.shields.io/badge/Stagehand-3_Interaction_Modes-green?style=for-the-badge)](https://stagehand.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-4285F4?style=for-the-badge&logo=googlegemini)](https://ai.google.dev/)

Built for [WeaveHacks 3](https://lu.ma/weavehacks3)

</div>

---

## Demo

https://github.com/user-attachments/assets/webscout-demo.mp4

<div align="center">

https://github.com/nihalnihalani/WebScout/raw/main/demo-video/out/webscout-demo.mp4

*40-second overview of WebScout's architecture and learning pipeline*

</div>

---

## Why WebScout Exists

Web scraping is **fundamentally fragile**. Sites change layouts overnight, cookie banners appear without warning, and A/B tests mean two users see completely different pages. Traditional scrapers break silently and require constant manual maintenance.

Every existing tool treats scraping as a stateless operation: fetch, parse, hope it works. When it breaks, a human fixes it. When it breaks again, the same human fixes the same thing.

**WebScout takes a different approach.** Every single task execution writes learning data back into the system. Successes reinforce pattern fitness. Failures increment failure counters and raise the confidence threshold. Recoveries store brand new patterns. The system cannot run without learning — it's not an optional feature, it's the architecture.

### What Makes This Different

| Approach | Traditional Scrapers | WebScout |
|----------|---------------------|----------|
| **Failure handling** | Break silently, wait for human | 4 adaptive recovery strategies, ordered by per-domain success rate |
| **Pattern reuse** | Manual selectors, hardcoded rules | 1536-dim vector embeddings with semantic KNN search — generalizes across similar pages |
| **Confidence** | Binary: works or doesn't | Wilson Score + time decay + dynamic threshold that adjusts itself |
| **Observability** | Logs at best | 7-level Weave integration with structured traces, retrospective feedback, formal evaluations |
| **Learning** | None | Every path writes back — successes, failures, and recoveries all teach the system |
| **Staleness** | Dead selectors accumulate | Patterns below fitness 0.05 with 3+ failures are auto-pruned |
| **Improvement proof** | "It seems better" | Cohort-based measurement with weighted scoring and letter grades |

---

## Table of Contents

- [The Learning Loop](#1-the-self-improving-learning-loop)
- [Pattern Fitness Scoring](#2-pattern-fitness-scoring-wilson-score--time-decay)
- [Negative Learning](#3-negative-learning--auto-pruning)
- [Dynamic Confidence Threshold](#4-dynamic-confidence-threshold)
- [Adaptive Recovery Ordering](#5-adaptive-recovery-ordering)
- [Vector Similarity Search](#6-vector-similarity-search-redis--hnsw)
- [Weave — 7 Levels Deep](#7-weave-integration--7-levels-deep)
- [Redis Architecture](#8-redis-architecture--6-key-patterns)
- [Real-Time SSE Streaming](#9-real-time-sse-streaming)
- [Quality Assessment](#10-quality-assessment)
- [Cohort-Based Improvement](#11-cohort-based-improvement-measurement)
- [Gemini Pre-Analysis](#12-gemini-pre-analysis)
- [Browserbase + Stagehand](#13-browserbase--stagehand)
- [Architecture](#architecture)
- [Tech Stack Deep Dive](#tech-stack--deep-dive)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)

---

## 1. The Self-Improving Learning Loop

> *"Every single task execution writes learning data back into the system. Successes reinforce pattern fitness. Failures increment failure counters and raise the confidence threshold. Recoveries store brand new patterns. The system literally cannot run without learning."*

The core `learningScrape()` function in [`scraper.ts`](webscout/src/lib/engine/scraper.ts) runs a 5-stage pipeline on every task:

```
   1. SEARCH          2. TRY CACHE         3. FRESH EXTRACT
   ┌───────────┐      ┌───────────┐        ┌───────────┐     ┌───────────┐
   │  Vector   │─────>│  Cached   │──miss─>│  Gemini   │────>│  Direct   │
   │   KNN     │      │  Pattern  │        │ PreAnalyze│     │  Extract  │
   │  Search   │      │  (>85%)   │        │  (DOM)    │     │ Stagehand │
   └───────────┘      └─────┬─────┘        └───────────┘     └─────┬─────┘
                            │ hit                                   │ fail
                            ▼                                       ▼
   5. OBSERVE          4. LEARN                  3b. RECOVERY
   ┌───────────┐      ┌───────────┐              ┌───────────┐
   │  Weave    │<─────│  Store    │<─────────────│  4-Strategy│
   │  7-Level  │      │  Vector   │              │  Adaptive  │
   │  Trace    │      │ Embedding │              │  Recovery  │
   └───────────┘      └───────────┘              └───────────┘
```

| Stage | What Happens | Technical Detail | Code |
|-------|-------------|-----------------|------|
| **1. Vector Search** | KNN query against Redis HNSW index | 1536-dim `text-embedding-3-small` vectors, cosine distance, top-10 candidates, query = `{url_pattern} {target}` | [`vectors.ts`](webscout/src/lib/redis/vectors.ts) |
| **2. Cache Match** | Composite ranking + threshold check | `composite = similarity × 0.6 + fitness × 0.4`. Must exceed dynamic threshold (0.70-0.95) stored in Redis. | [`scraper.ts`](webscout/src/lib/engine/scraper.ts) |
| **3. Gemini Pre-Analysis** | DOM snapshot sent to Gemini before extraction | Gemini 2.0-flash analyzes page structure, suggests CSS selectors and extraction strategy with reasoning | [`gemini.ts`](webscout/src/lib/ai/gemini.ts) |
| **3a. Fresh Extraction** | Stagehand AI extracts from live page | Browserbase cloud browser + Stagehand `extract()` with Zod schemas for structured output | [`stagehand-client.ts`](webscout/src/lib/browser/stagehand-client.ts) |
| **3b. Recovery** | 4 strategies in adaptive order | Per-domain stats determine order. Agent → Act → Extract Refined → Gemini. Each outcome recorded. | [`recovery.ts`](webscout/src/lib/engine/recovery.ts) |
| **4. Learn** | Write back to the system | Store pattern as vector embedding, update fitness, record strategy outcome, adjust threshold | [`pattern-extractor.ts`](webscout/src/lib/engine/pattern-extractor.ts) |
| **5. Observe** | Full Weave tracing | Custom `summarize()` returns 8 structured metrics. 4 retrospective feedback scores attached via trace server API. | [`weave.ts`](webscout/src/lib/tracing/weave.ts) |

**Every path writes back.** Cache hit? Update `success_count` and `last_succeeded_at`. Cache miss? Fresh extraction stores a new pattern. Cache failure? Increment `failure_count`, raise threshold by 0.02. Recovery succeeds? Store the recovery pattern. Recovery fails? Record the failure for that strategy on that domain. The system cannot execute a task without learning from it.

---

## 2. Pattern Fitness Scoring (Wilson Score + Time Decay)

> *"We use the Wilson Score Lower Bound — the same algorithm Reddit uses to rank comments — to get a statistically reliable success estimate even for patterns with few data points. Then we multiply by exponential time decay with a 30-day half-life, because a pattern that worked 6 months ago on a site that's probably changed isn't worth much."*

Implemented in [`pattern-fitness.ts`](webscout/src/lib/engine/pattern-fitness.ts) — a pure synchronous function called in the ranking pipeline:

### The Math

**Step 1: Wilson Score Lower Bound** (95% confidence)

```
p = success_count / total
z = 1.96 (95% CI)
denominator = 1 + z²/n
center = p + z²/2n
spread = z × √(p(1-p)/n + z²/4n²)
wilsonLower = (center - spread) / denominator
```

Why Wilson and not raw success rate? A pattern with 3/3 successes (100%) ranks **lower** than one with 50/52 (96%) because we have far less confidence in the small sample. Wilson penalizes uncertainty — this prevents new patterns from outranking battle-tested ones.

**Step 2: Exponential Time Decay** (30-day half-life)

```
daysSinceActivity = (now - lastActivity) / (1000 × 60 × 60 × 24)
decay = 0.5 ^ (daysSinceActivity / 30)
```

A 90-day-old pattern retains only 12.5% of its score. Sites change — patterns must prove themselves continuously.

**Step 3: Recency Bonus**

```
+0.15 if last success < 24 hours ago
+0.075 if last success < 7 days ago
```

**Step 4: Final Composite**

```
fitness = clamp(0, 1, wilsonLower × decay + recencyBonus)
composite = vectorSimilarity × 0.6 + fitness × 0.4
```

Patterns compete on both semantic relevance and proven reliability.

---

## 3. Negative Learning + Auto-Pruning

> *"Most caching systems only remember successes. Ours tracks failures too. If a pattern starts failing — maybe the site redesigned — its fitness score drops. Below 0.2 it gets filtered from results. Below 0.05 with 3+ failures it gets auto-pruned. The system actively forgets what doesn't work anymore."*

Implemented across [`vectors.ts`](webscout/src/lib/redis/vectors.ts), [`scraper.ts`](webscout/src/lib/engine/scraper.ts), [`pattern-pruner.ts`](webscout/src/lib/engine/pattern-pruner.ts):

Every pattern in Redis carries:

```typescript
{
  success_count: number,
  failure_count: number,
  last_succeeded_at: number,   // timestamp
  last_failed_at: number,      // timestamp
}
```

| Event | System Response | Function |
|-------|----------------|----------|
| Cached pattern **succeeds** | `success_count++`, update `last_succeeded_at` | `updatePatternLastSuccess()` |
| Cached pattern **fails** | `failure_count++`, update `last_failed_at` | `incrementPatternFailure()` |
| Fitness **< 0.2** | Pattern filtered from KNN results — exists but never used | Ranking filter in `scraper.ts` |
| Fitness **< 0.05** AND `failure_count ≥ 3` | Pattern **auto-deleted** from Redis entirely | `pruneDeadPatterns()` |

This is how the system handles site redesigns gracefully. No human intervention needed — dead patterns decay, get filtered, and eventually get pruned.

---

## 4. Dynamic Confidence Threshold

> *"The confidence threshold for using cached patterns isn't static. It adjusts itself. Every successful cache hit lowers the threshold by half a percent — the system gets bolder. Every cache failure raises it by 2 percent — four times the penalty. It's asymmetric because a false positive is more expensive than a false negative."*

Implemented in [`pattern-extractor.ts`](webscout/src/lib/engine/pattern-extractor.ts):

```
Redis key:        webscout:confidence_threshold
Range:            [0.70, 0.95]
Default:          0.85

Cache success:    threshold -= 0.005  (bolder)
Cache failure:    threshold += 0.02   (cautious)
Penalty ratio:    4:1 (failures penalize 4× more than successes reward)
```

**Why asymmetric?** A false positive (replaying a bad cached pattern) wastes a browser session, burns API credits, and delays the task. A false negative (doing a fresh extraction when cache would have worked) costs more compute but still succeeds. The 4:1 ratio reflects this cost asymmetry.

The threshold persists in Redis across deployments and restarts.

---

## 5. Adaptive Recovery Ordering

> *"Recovery isn't random. We track per-domain success rates for each of our four recovery strategies in Redis. If agent-mode recovery works 80% of the time on Amazon but only 20% on Wikipedia, the system learns that and reorders accordingly. It's a multi-armed bandit — we try the best-known strategy first, track duration, and adapt over time."*

Implemented in [`strategy-selector.ts`](webscout/src/lib/engine/strategy-selector.ts) and [`recovery.ts`](webscout/src/lib/engine/recovery.ts):

### The 4 Strategies

| # | Strategy | What It Does | Powered By | Best For |
|---|----------|-------------|-----------|----------|
| 1 | **Agent** | Autonomous GPT-4o agent that reasons about the page, navigates complex flows, handles multi-step interactions | Stagehand `agent.execute()` | Complex SPAs, multi-step flows |
| 2 | **Act** | Blocker removal — dismiss cookie banners, close modals, scroll past overlays, then re-extract | Stagehand `act()` | Cookie walls, GDPR popups, paywalls |
| 3 | **Extract Refined** | Re-extraction with enriched instructions targeting main content, sidebars, tables, metadata | Stagehand `extract()` + hints | Pages where initial selectors were too broad |
| 4 | **Gemini** | Full DOM snapshot analyzed by Gemini, which suggests alternative CSS selectors for a different approach | Gemini 2.0-flash | Unusual page structures, non-standard layouts |

### Per-Domain Learning

```
Redis key:   strategy_stats:{urlPattern}:{strategy}
Fields:      { attempts: number, successes: number, avg_duration_ms: number }
```

- `recordStrategyOutcome()` updates stats with running average duration after each attempt
- `getOrderedStrategies()` sorts by success rate descending, breaking ties by avg duration ascending
- The system learns that different sites respond to different strategies

---

## 6. Vector Similarity Search (Redis + HNSW)

> *"Pattern matching isn't keyword-based — it's semantic. We embed every URL pattern and target description into a 1536-dimensional vector using OpenAI embeddings, store them in a Redis HNSW index, and do KNN cosine similarity search. So if you taught WebScout to extract prices from amazon.com/products, and a new task comes in for amazon.com/electronics, the vector search finds that pattern because the semantic meaning is similar, not because the strings match."*

Implemented in [`vectors.ts`](webscout/src/lib/redis/vectors.ts):

### Index Configuration

```
Index:       idx:page_patterns
Algorithm:   HNSW (Hierarchical Navigable Small World)
Type:        FLOAT32
Dimensions:  1536
Distance:    COSINE
Embeddings:  OpenAI text-embedding-3-small
```

### Schema

```
TEXT fields:     url_pattern, target, working_selector
TAG fields:      approach
NUMERIC fields:  created_at, success_count, failure_count, last_succeeded_at, last_failed_at
VECTOR field:    embedding (1536-dim HNSW)
```

### Query Flow

1. Build query text: `{url_pattern} {target}`
2. Embed via `text-embedding-3-small` → 1536-dim vector
3. KNN search: `*=>[KNN 10 @embedding $BLOB AS vector_score]`
4. Normalize: `similarity = 1 - vectorScore / 2`
5. Re-rank by composite: `similarity × 0.6 + fitness × 0.4`

### Why This Matters

Keyword matching fails across URL variations. Vector search generalizes:
- `amazon.com/dp/B08N5` → matches `amazon.com/products/electronics` (product pages)
- `news.ycombinator.com` → matches `lobste.rs` (link aggregators)
- `github.com/user/repo` → matches `gitlab.com/user/project` (code hosting)

The learning transfers across semantically similar pages, not just exact URL matches.

---

## 7. Weave Integration — 7 Levels Deep

> *"This isn't `weave.init()` and done. The entire feedback loop flows through Weave."*

Implemented in [`weave.ts`](webscout/src/lib/tracing/weave.ts), [`trace-context.ts`](webscout/src/lib/tracing/trace-context.ts), [`batch-eval.ts`](webscout/src/lib/evaluation/batch-eval.ts), [`weave-eval-logger.ts`](webscout/src/lib/evaluation/weave-eval-logger.ts):

### Level 1: Traced Operations with Structured Summaries

Every meaningful function is a `weave.op()` with a custom `summarize()` callback that returns structured metrics — not just "it ran":

| Operation | Metrics in Summary |
|-----------|-------------------|
| `learningScrape` | `success`, `used_cache`, `recovery_attempted`, `recovery_succeeded`, `pattern_learned`, `quality_score`, `duration_ms`, `steps_count` |
| `attemptRecovery` | `recovery_success`, `recovery_strategy` |
| `pruneDeadPatterns` | `patterns_pruned`, `patterns_remaining` |
| `searchSimilarPatterns` | match count, top similarity scores |
| `storePattern` | pattern ID, selector, approach |
| `adjustConfidenceThreshold` | new value, direction, delta |

### Level 2: Invoke + Call ID Capture

`learningScrape` is created via `createInvocableOp()`. The API route calls `.invoke()` which returns `[result, Call]`. The `Call.id` is essential for Level 3.

### Level 3: Retrospective Feedback via Trace Server API

After every task completes, `addScoreToCall()` uses the raw Weave trace server API (`traceServerApi.feedback.feedbackCreateFeedbackCreatePost()`) to attach **4 feedback scores** to the call:

| Score Key | Type | What It Captures |
|-----------|------|-----------------|
| `webscout.success` | boolean → 0/1 | Did the extraction produce valid data? |
| `webscout.quality` | 0-100 + comment | GPT-4o quality assessment of extracted content |
| `webscout.used_cache` | boolean | Was a cached pattern used? (tracks cache adoption) |
| `webscout.recovery_needed` | boolean | Did recovery strategies fire? (tracks reliability) |

This is not the evaluation-only `addScore()` — it's the raw feedback endpoint that attaches scores to any call.

### Level 4: Pattern Dataset Versioning

`savePatternDataset()` creates a versioned `weave.Dataset` named `"webscout-learned-patterns"`. Each save creates a new version. You can track exactly how the pattern library evolves over time in the Weave UI — what patterns were added, which ones gained fitness, which ones decayed.

### Level 5: Inline Weave Images

`createWeaveImage(base64)` converts browser screenshots to `weave.weaveImage()` format. Screenshots render **inline in the Weave trace viewer** — you can see exactly what the agent saw at each step of the pipeline without leaving the trace UI.

### Level 6: Formal Batch Evaluation

4 typed scorers, each a `weave.op()`:

| Scorer | Logic |
|--------|-------|
| `webscout.scorer.success` | Binary: 1.0 if extraction succeeded, 0.0 if not |
| `webscout.scorer.speed` | Linear interpolation: ≤3s → 1.0, ≥60s → 0.0 |
| `webscout.scorer.cache_efficiency` | 1.0 if cached, 0.5 if fresh, 0.25 if recovery needed |
| `webscout.scorer.quality` | Normalized extraction quality from GPT-4o assessment |

A `replayModel` replays historical task results as a Weave model. `weave.Evaluation` runs all 4 scorers over a `weave.Dataset` built from task history — producing formal evaluation results in the Weave dashboard.

### Level 7: Context Propagation

`withWeaveAttributes()` propagates `taskId`, `urlPattern`, `target`, and `sessionType` to all child spans. Every operation in a task inherits these attributes, enabling filtering in the Weave UI by any dimension — "show me all traces for amazon.com" or "show me all cache misses."

---

## 8. Redis Architecture — 6 Key Patterns

> *"Redis isn't just our cache — it's our entire learning state. All learning state is in Redis, which means the system picks up exactly where it left off across restarts and deployments."*

Implemented across [`vectors.ts`](webscout/src/lib/redis/vectors.ts), [`tasks.ts`](webscout/src/lib/redis/tasks.ts), [`client.ts`](webscout/src/lib/redis/client.ts):

| Key Pattern | Redis Type | What It Stores |
|-------------|-----------|----------------|
| `pattern:{uuid}` | Hash | Complete pattern: 1536-dim embedding, working selector, approach, `success_count`, `failure_count`, `last_succeeded_at`, `last_failed_at`, `created_at` |
| `idx:page_patterns` | RediSearch Index | HNSW vector index over all `pattern:*` hashes. Config: FLOAT32, 1536 dims, COSINE distance. Enables sub-millisecond KNN search. |
| `task:{id}` | Hash | Full task data: URL, target, status, all execution steps with screenshots, pattern used, recovery attempts, quality score, timestamps |
| `tasks:timeline` | Sorted Set | Task IDs scored by creation timestamp. Enables chronological listing and cohort splitting for evaluation. |
| `strategy_stats:{urlPattern}:{strategy}` | Hash | Per-domain, per-strategy stats: `attempts`, `successes`, `avg_duration_ms`. Powers adaptive recovery ordering. |
| `webscout:confidence_threshold` | String | Single float value (0.70-0.95). The dynamic confidence threshold that adjusts on every cache hit/miss. |

**Why Redis for everything?** All learning state in one place means:
- System picks up exactly where it left off after restart
- No cold start — patterns, stats, and threshold persist across deployments
- Vector search + key-value storage + sorted sets in a single service
- Sub-millisecond reads for the hot path (pattern lookup)

---

## 9. Real-Time SSE Streaming

> *"When you submit a task, the dashboard connects via Server-Sent Events. The server polls Redis every 500ms and streams step-by-step updates — you see each extraction attempt, each recovery strategy, each pattern learned — as it happens."*

### Server — [`api/tasks/[id]/stream/route.ts`](webscout/src/app/api/tasks/%5Bid%5D/stream/route.ts)

- `ReadableStream` with `TextEncoder` for SSE protocol
- Polls Redis every 500ms for new steps via `getTask()`
- 120-second safety timeout prevents zombie connections
- Named events: `done` (task complete), `error` (server error)

### Client — [`use-task-stream.ts`](webscout/src/hooks/use-task-stream.ts)

- Native `EventSource` API with automatic reconnect on transient errors
- Preserves last known state during disconnects — no UI flicker
- Merges incremental step updates into the task state

### Progress Flushing — [`tasks.ts`](webscout/src/lib/redis/tasks.ts)

The scraper calls `flushProgress()` via `updateTaskProgress()` after every significant step — cache hit, extraction attempt, recovery start, pattern store. This writes intermediate state to Redis so the SSE stream picks up steps in near real-time, even while the scraper is still working on a different part of the pipeline.

---

## 10. Quality Assessment

> *"Every extraction gets a quality score from GPT-4o — not just pass/fail, but a 0-100 assessment of how complete and accurate the extracted data is. That score feeds into the evaluation pipeline and shows up as Weave feedback on the call."*

Implemented in [`openai-quality.ts`](webscout/src/lib/ai/openai-quality.ts):

- After every successful extraction: `assessExtractionQuality()` calls GPT-4o with the extracted data, the target description, and the source URL
- Returns: **0-100 quality score** + text summary explaining the assessment
- Score is attached to the Weave call as `webscout.quality` feedback (Level 3)
- Feeds into evaluation pipeline with **20% weight** in overall improvement score
- Distinguishes between "it extracted something" and "it extracted the right thing well"

---

## 11. Cohort-Based Improvement Measurement

> *"We prove improvement quantitatively. We split task history into thirds and compute deltas across five metrics. After enough tasks, you can literally see the grade go from D to A as the system learns. This isn't a claim — it's measured."*

Implemented in [`batch-eval.ts`](webscout/src/lib/evaluation/batch-eval.ts) and [`/api/evaluation`](webscout/src/app/api/evaluation/route.ts):

### Process

1. Sort all tasks chronologically
2. Split into **three cohorts**: early (first third), middle, late (last third)
3. Compute **6 metrics per cohort**: `success_rate`, `avg_duration`, `cache_hit_rate`, `recovery_rate`, `avg_quality_score`, `task_count`
4. Compute deltas between early and late cohorts
5. Calculate weighted improvement score

### Weighted Scoring

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Success Rate | **30%** | The most important metric — does it work? |
| Speed | **25%** | Cache hits should make it faster over time |
| Cache Efficiency | **25%** | Higher cache hit rate = more learning |
| Quality | **20%** | Not just pass/fail — quality should improve too |

### Letter Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | ≥ 70 | Strong measurable improvement across dimensions |
| **B** | ≥ 50 | Clear improvement trend |
| **C** | ≥ 30 | Some improvement, system is learning |
| **D** | < 30 | Early stage — not enough data yet |

### Measured Results

| Metric | Early Tasks | Recent Tasks | Delta |
|--------|------------|--------------|-------|
| **Success Rate** | 86% | 100% | **+17%** |
| **Extraction Speed** | 10.1s | 2.7s | **3.7x faster** |
| **Cache Hit Rate** | 14% | 83% | **+69 percentage points** |
| **Recovery Needed** | 86% | 17% | **-81%** |

These numbers emerge naturally as the vector cache fills with successful patterns. No manual tuning.

---

## 12. Gemini Pre-Analysis

> *"Before we extract, we optionally send a DOM snapshot to Google Gemini for pre-analysis. Gemini suggests which CSS selectors are likely to contain the target data. During recovery, Gemini analyzes why the previous attempt failed and suggests alternative selectors. It's a second AI opinion before we commit to an extraction strategy."*

Implemented in [`gemini.ts`](webscout/src/lib/ai/gemini.ts) — uses **Gemini 2.0-flash** for speed:

| Function | Phase | What It Does |
|----------|-------|-------------|
| `geminiAnalyzePage()` | Before fresh extraction | Sends DOM snapshot + target description. Returns: suggested CSS selectors, recommended extraction strategy (`direct`, `scroll_first`, `click_expand`), and reasoning. |
| `getGeminiRecoveryStrategy()` | During recovery | Receives the failed attempt context. Analyzes why it failed. Suggests alternative selectors and a different approach. |
| `isGeminiAvailable()` | Startup | Checks API key availability. Gemini is optional — the system works without it but benefits from the second opinion. |

Gemini suggestions are appended as hints to the Stagehand extraction instruction, improving first-attempt success rates on unfamiliar pages.

---

## 13. Browserbase + Stagehand

> *"We use Browserbase for cloud browser infrastructure — every task runs in an isolated browser session with a debuggable live URL. Stagehand provides three levels of browser interaction: extract for structured AI extraction, act for clicking and interacting, and agent for full autonomous reasoning. The recovery pipeline uses all three."*

### Browserbase — [`session.ts`](webscout/src/lib/browser/session.ts)

- Every task spawns an **isolated cloud browser session** — no local Chrome installation needed
- Each session has a **live debuggable URL** stored with the task for real-time viewing and post-mortem debugging
- Sessions are managed and cleaned up automatically
- The `/live` dashboard page embeds the session viewer for real-time watching

### Stagehand — [`stagehand-client.ts`](webscout/src/lib/browser/stagehand-client.ts)

Three levels of AI-powered browser interaction, each used in different parts of the pipeline:

| Method | Level | Usage in WebScout | Powered By |
|--------|-------|------------------|-----------|
| `stagehand.extract()` | Structured extraction | **Primary extraction path.** AI-powered data extraction with Zod schemas for typed, structured output. Used for both cached pattern replay and fresh extraction. | GPT-4o |
| `stagehand.act()` | Browser actions | **Recovery strategy #2.** Click consent buttons, dismiss cookie banners, close modals, scroll past overlays, accept GDPR popups — then re-extract. | GPT-4o |
| `stagehand.agent.execute()` | Autonomous reasoning | **Recovery strategy #1.** Full autonomous GPT-4o agent that reasons about the page, plans a multi-step approach, navigates complex flows. The most powerful but most expensive strategy. | GPT-4o |
| `page.goto()`, `page.screenshot()`, `page.evaluate()` | Standard Playwright | Navigation, screenshot capture for Weave traces, DOM evaluation for Gemini analysis | Playwright |

The recovery pipeline chains all three: try `extract` → `act` to remove blockers → `extract` with refined hints → `agent` for autonomous reasoning.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     WebScout Dashboard                        │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Live View│ │Evaluation│ │ Patterns │ │ Teaching │       │
│  │  (SSE)   │ │ (Cohorts)│ │ (Browse) │ │ (Manual) │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │  Tasks   │ │ Timeline │ │  Health  │                     │
│  │ (Manage) │ │ (Trace)  │ │ (Status) │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
└────────────────────────────┬─────────────────────────────────┘
                             │ Next.js API Routes (12 endpoints)
┌────────────────────────────▼─────────────────────────────────┐
│                     Learning Engine                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  learningScrape()                        │ │
│  │                                                         │ │
│  │  Vector Search → Cache Match → Gemini → Extract         │ │
│  │       ↑              │                      │           │ │
│  │       │              ↓                      ↓           │ │
│  │  Pattern Store ← Learn ←──────────── Recovery           │ │
│  │       ↑                                ↑    │           │ │
│  │       │          Strategy Selector ────┘    │           │ │
│  │       │              │                      │           │ │
│  │  Fitness Scoring  Negative Learning  Confidence Adj     │ │
│  │  (Wilson+Decay)   (Auto-Prune)      (Asymmetric 4:1)   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────┬──────────────┬──────────────┬─────────────────────────┘
       │              │              │
┌──────▼───┐   ┌─────▼──────┐  ┌───▼───────────┐
│  Redis    │   │ Browserbase│  │    Weave      │
│  Stack    │   │ + Stagehand│  │               │
│           │   │            │  │ 7 Integration │
│ 6 Key     │   │ 3 Interact │  │    Levels     │
│ Patterns  │   │   Modes    │  │               │
│           │   │            │  │ Traces →      │
│ • HNSW    │   │ • extract  │  │ Feedback →    │
│   Vector  │   │ • act      │  │ Datasets →    │
│ • Pattern │   │ • agent    │  │ Images →      │
│   Hashes  │   │            │  │ Evaluations → │
│ • Task    │   │ Live debug │  │ Context prop  │
│   History │   │ URLs       │  │               │
│ • Strategy│   └────────────┘  └───────────────┘
│   Stats   │         │              │
│ • Confid. │   ┌─────▼──────┐  ┌───▼───────────┐
│   Thresh. │   │   OpenAI   │  │    Vercel     │
│ • Timeline│   │            │  │               │
└───────────┘   │ • GPT-4o   │  │ • Next.js 15  │
                │   (extract) │  │ • App Router  │
          ┌─────│ • embed-3  │  │ • SSE streams │
          │     │   (vectors) │  │ • Serverless  │
          │     │ • GPT-4o   │  └───────────────┘
          │     │   (quality) │
          │     └────────────┘
          │
    ┌─────▼──────┐
    │   Gemini   │
    │  2.0-flash │
    │            │
    │ • DOM pre- │
    │   analysis │
    │ • Recovery │
    │   strategy │
    └────────────┘
```

---

## Tech Stack — Deep Dive

| Technology | Role | Technical Depth |
|-----------|------|----------------|
| **Weave (W&B)** | Observability + evaluation | 7 integration levels: `weave.op()` with custom `summarize()`, `createInvocableOp()` for Call ID capture, raw trace server API for retrospective feedback, versioned `weave.Dataset` for pattern evolution, `weave.weaveImage()` for inline screenshots, formal `weave.Evaluation` with 4 typed scorers, `withWeaveAttributes()` for context propagation |
| **Redis Stack + RediSearch** | Learning state + vector search | 6 key patterns: HNSW vector index (`FLOAT32`, 1536-dim, `COSINE`), pattern hashes with fitness fields, sorted set timeline, per-domain strategy stats with running averages, dynamic confidence threshold. All learning state persists across deployments. Sub-ms reads on hot path. |
| **Browserbase** | Cloud browser infrastructure | Isolated cloud browser sessions per task. Live debuggable URLs stored with each task. No local Chrome needed. Session management with automatic cleanup. Embedded viewer in dashboard `/live` page. |
| **Stagehand v3** | AI browser interaction | 3 interaction modes: `extract()` with Zod schemas for typed structured output, `act()` for browser actions (click, scroll, dismiss), `agent.execute()` for autonomous GPT-4o reasoning. All three chained in recovery pipeline. |
| **OpenAI GPT-4o** | Extraction + quality | Powers Stagehand extraction and autonomous agent. `assessExtractionQuality()` provides 0-100 quality scores with text summaries. Scores feed into evaluation pipeline at 20% weight. |
| **OpenAI text-embedding-3-small** | Semantic vectors | 1536-dimensional embeddings for URL patterns and target descriptions. Enables generalization across semantically similar pages (amazon.com/products → amazon.com/electronics). |
| **Google Gemini 2.0-flash** | Second AI opinion | DOM pre-analysis suggests CSS selectors before extraction. Recovery analysis when primary extraction fails. Provides structural understanding from a different model's perspective. Optional — system works without it. |
| **Next.js 15 + React 19** | Full-stack framework | App Router with 12 serverless API routes. SSE streaming via `ReadableStream`. 8 dashboard pages. React 19 with hooks for real-time state. |
| **Tailwind CSS v4 + shadcn/ui** | Dashboard UI | Dark-themed responsive dashboard. Cards, tables, badges, tabs. Recharts for learning curve and improvement visualizations. |
| **Vercel** | Deployment | Edge-optimized Next.js deployment. Serverless API routes handle task submission, SSE streaming, evaluation, and pattern management. |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Redis Stack** (with RediSearch module — required for vector search)
- **API keys**: Browserbase, OpenAI, Weights & Biases, Google AI (Gemini is optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/nihalnihalani/WebScout.git
cd WebScout/webscout

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see below)

# Start Redis Stack (with RediSearch)
docker compose up -d
# Or install locally:
# macOS: brew install redis-stack && redis-stack-server &
# Linux: See https://redis.io/docs/install/install-stack/

# Run the development server
npm run dev

# Seed demo data (optional — populates example tasks and patterns)
curl -X POST http://localhost:3000/api/demo/seed
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Environment Variables

```env
# Required
BROWSERBASE_API_KEY=           # browserbase.com/settings
BROWSERBASE_PROJECT_ID=        # Browserbase dashboard
OPENAI_API_KEY=                # platform.openai.com/api-keys
REDIS_URL=                     # Default: redis://localhost:6379
WANDB_API_KEY=                 # wandb.ai/authorize

# Optional
WEAVE_PROJECT=                 # Default: webscout
GOOGLE_AI_API_KEY=             # aistudio.google.com/apikey (Gemini — optional but recommended)
```

### Reset & Re-seed

```bash
# Clear ALL data (tasks, patterns, strategy stats, confidence threshold)
curl -X POST http://localhost:3000/api/demo/reset

# Re-seed fresh demo data
curl -X POST http://localhost:3000/api/demo/seed
```

---

## Dashboard Pages

| Page | Route | What You See |
|------|-------|-------------|
| **Home** | `/` | Task submission form. Enter URL + target description, watch it execute in real-time. |
| **Dashboard** | `/dashboard` | Stats overview, learning curve chart (Recharts), recent tasks with status indicators |
| **Live View** | `/live` | Embedded Browserbase session viewer — watch the agent navigate, click, and extract in real-time |
| **Tasks** | `/tasks` | Task list with status, duration, cache hit/miss badges, recovery indicators |
| **Task Detail** | `/tasks/[id]` | Full execution log: step-by-step trace with screenshots, timing, pattern used, quality score |
| **Patterns** | `/patterns` | Pattern library grid — browse all learned patterns with fitness scores, success/failure counts, selectors |
| **Evaluation** | `/evaluation` | Cohort comparison, improvement deltas, letter grade, weighted scoring breakdown |
| **Teach** | `/teach` | Manual teaching mode — teach extraction patterns for specific sites by providing URL + selector + approach |

---

## Project Structure

```
webscout/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Home — task submission
│   │   ├── dashboard/page.tsx        # Stats + learning curve
│   │   ├── live/page.tsx             # Real-time browser view
│   │   ├── tasks/page.tsx            # Task list
│   │   ├── tasks/[id]/page.tsx       # Task detail + execution log
│   │   ├── patterns/page.tsx         # Pattern library
│   │   ├── evaluation/page.tsx       # Improvement metrics
│   │   ├── teach/page.tsx            # Manual teaching mode
│   │   └── api/
│   │       ├── tasks/route.ts        # POST: submit task, GET: list
│   │       ├── tasks/[id]/route.ts   # GET: task detail
│   │       ├── tasks/[id]/stream/    # SSE: real-time updates
│   │       ├── patterns/route.ts     # GET: learned patterns
│   │       ├── evaluation/route.ts   # GET: cohort metrics
│   │       ├── evaluation/batch/     # POST: formal Weave eval
│   │       ├── teach/route.ts        # POST: manual teaching
│   │       ├── health/route.ts       # GET: service health
│   │       ├── metrics/route.ts      # GET: aggregate stats
│   │       ├── timeline/route.ts     # GET: task timeline
│   │       └── demo/
│   │           ├── seed/route.ts     # POST: seed demo data
│   │           └── reset/route.ts    # POST: clear everything
│   │
│   ├── lib/
│   │   ├── engine/                   # Core learning engine
│   │   │   ├── scraper.ts            # THE learning loop — learningScrape()
│   │   │   ├── recovery.ts           # 4-strategy recovery pipeline
│   │   │   ├── pattern-fitness.ts    # Wilson Score + time decay
│   │   │   ├── pattern-extractor.ts  # Pattern storage + confidence threshold
│   │   │   ├── pattern-pruner.ts     # Auto-prune dead patterns
│   │   │   └── strategy-selector.ts  # Adaptive recovery ordering
│   │   │
│   │   ├── redis/                    # Redis integration (6 key patterns)
│   │   │   ├── client.ts             # Connection management
│   │   │   ├── vectors.ts            # HNSW vector search + pattern CRUD
│   │   │   ├── patterns.ts           # Pattern queries
│   │   │   └── tasks.ts              # Task storage + progress flushing
│   │   │
│   │   ├── browser/                  # Browserbase + Stagehand
│   │   │   ├── stagehand-client.ts   # 3-mode Stagehand init
│   │   │   └── session.ts            # Cloud session management
│   │   │
│   │   ├── ai/                       # AI integrations
│   │   │   ├── gemini.ts             # Gemini pre-analysis + recovery
│   │   │   └── openai-quality.ts     # GPT-4o quality scoring
│   │   │
│   │   ├── embeddings/
│   │   │   └── openai.ts             # text-embedding-3-small (1536-dim)
│   │   │
│   │   ├── tracing/                  # Weave (7 levels)
│   │   │   ├── weave.ts              # Ops, invoke, feedback, datasets
│   │   │   └── trace-context.ts      # Screenshots + DOM snapshots
│   │   │
│   │   ├── evaluation/               # Improvement measurement
│   │   │   ├── batch-eval.ts         # Formal Weave eval + 4 scorers
│   │   │   └── weave-eval-logger.ts  # Prediction logging
│   │   │
│   │   └── utils/
│   │       ├── types.ts              # TypeScript type definitions
│   │       └── url.ts                # URL pattern utilities
│   │
│   ├── components/                   # React UI (13 components + ui/)
│   │   ├── task-form.tsx             # Task submission
│   │   ├── task-list.tsx             # Task list + filters
│   │   ├── execution-log.tsx         # Step-by-step viewer
│   │   ├── trace-timeline.tsx        # Visual decision trace
│   │   ├── learning-timeline.tsx     # Learning event timeline
│   │   ├── learning-curve.tsx        # Recharts improvement charts
│   │   ├── improvement-report.tsx    # Cohort comparison + grades
│   │   ├── pattern-card.tsx          # Pattern with fitness score
│   │   ├── pattern-grid.tsx          # Pattern library grid
│   │   ├── stats-overview.tsx        # Aggregate statistics
│   │   ├── live-session-viewer.tsx   # Browserbase session embed
│   │   ├── empty-state.tsx           # Empty state placeholder
│   │   └── ui/                       # shadcn/ui primitives
│   │
│   └── hooks/                        # React hooks (8 hooks)
│       ├── use-task-stream.ts        # SSE live updates
│       ├── use-tasks.ts              # Task CRUD
│       ├── use-patterns.ts           # Pattern fetching
│       ├── use-evaluation.ts         # Evaluation data
│       ├── use-metrics.ts            # Aggregate metrics
│       ├── use-live-task.ts          # Live task tracking
│       ├── use-teach.ts              # Teaching mode
│       └── use-timeline.ts           # Timeline data
│
├── docker-compose.yml                # Redis Stack with RediSearch
├── package.json
└── tsconfig.json
```

---

## API Reference

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tasks` | Submit a scraping task. Body: `{ url, target, instruction? }`. Returns task ID immediately, executes async via learning pipeline. |
| `GET` | `/api/tasks` | List all tasks with stats. Query: `?limit=50` |
| `GET` | `/api/tasks/[id]` | Full task detail: steps, screenshots, patterns, quality score |
| `GET` | `/api/tasks/[id]/stream` | SSE stream — real-time step-by-step updates, polls Redis every 500ms |

### Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patterns` | All learned patterns with fitness scores, success/failure counts |
| `GET` | `/api/evaluation` | Cohort-based improvement metrics with weighted score and letter grade |
| `POST` | `/api/evaluation/batch` | Run formal Weave evaluation with all 4 typed scorers |
| `POST` | `/api/teach` | Manually teach a pattern. Body: `{ url, target, selector, approach }` |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health checks: Redis connection, Browserbase API, Weave project, AI model availability |
| `GET` | `/api/metrics` | Aggregate metrics: total tasks, success rate, avg duration, cache hit rate |
| `GET` | `/api/timeline` | Task timeline for dashboard charts |
| `POST` | `/api/demo/seed` | Populate demo data for showcasing |
| `POST` | `/api/demo/reset` | Clear everything: tasks, patterns, strategy stats, confidence threshold, vector index |

---

## License

MIT

---

<div align="center">

**WebScout** — Built for [WeaveHacks 3](https://lu.ma/weavehacks3)

*Every failed click makes it smarter.*

[Weave](https://wandb.ai/site/weave) | [Redis](https://redis.io/) | [Browserbase](https://www.browserbase.com/) | [Stagehand](https://stagehand.dev/) | [OpenAI](https://openai.com/) | [Gemini](https://ai.google.dev/) | [Vercel](https://vercel.com)

</div>
