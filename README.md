<div align="center">

# WebScout

### Every failed click makes it smarter.

A self-improving browser automation agent that learns from every success and failure, getting measurably faster and more accurate over time. This isn't a scraper with a cache bolted on — **the system literally cannot run without learning.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Weave](https://img.shields.io/badge/Weave-W%26B-FFBE00?style=for-the-badge&logo=weightsandbiases)](https://wandb.ai/site/weave)
[![Redis](https://img.shields.io/badge/Redis-Vector_Search-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Browserbase](https://img.shields.io/badge/Browserbase-Cloud_Browser-4A154B?style=for-the-badge)](https://www.browserbase.com/)

Built for [WeaveHacks 3](https://lu.ma/weavehacks3)

</div>

---

## The Problem

Web scraping is **fundamentally fragile**. Sites change layouts overnight, cookie banners appear without warning, and A/B tests mean two users see completely different pages. Traditional scrapers break silently and require constant manual maintenance.

**What if your scraper got smarter every time it failed?**

## The Solution

WebScout is a **self-improving browser automation agent** that treats every single task execution as a learning opportunity. Every path through the system writes data back — successes reinforce pattern fitness, failures increment failure counters and raise the confidence threshold, recoveries store brand new patterns.

The result: an agent that starts competent and becomes expert, with the data to prove it.

---

## Table of Contents

- [How It Works](#how-it-works--the-self-improving-learning-loop)
- [Pattern Fitness Scoring](#pattern-fitness-scoring)
- [Negative Learning](#negative-learning--the-system-actively-forgets)
- [Dynamic Confidence Threshold](#dynamic-confidence-threshold)
- [Adaptive Recovery Ordering](#adaptive-recovery-ordering)
- [Vector Similarity Search](#vector-similarity-search)
- [Weave Integration (7 Levels Deep)](#weave-integration--7-levels-deep)
- [Redis Architecture](#redis-architecture--6-key-patterns)
- [Real-Time SSE Streaming](#real-time-sse-streaming)
- [Quality Assessment](#quality-assessment)
- [Cohort-Based Improvement Measurement](#cohort-based-improvement-measurement)
- [Gemini Pre-Analysis](#gemini-pre-analysis)
- [Browserbase + Stagehand](#browserbase--stagehand)
- [Architecture](#architecture)
- [Dashboard](#dashboard)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Sponsor Integrations](#sponsor-integrations)

---

## How It Works — The Self-Improving Learning Loop

The core `learningScrape()` function in [`src/lib/engine/scraper.ts`](webscout/src/lib/engine/scraper.ts) runs a 5-stage pipeline on every task. Every path through this pipeline writes learning data back into the system.

```
   1. SEARCH          2. TRY CACHE         3. FRESH EXTRACT
   ┌───────────┐      ┌───────────┐        ┌───────────┐
   │  Vector   │─────>│  Cached   │──miss─>│  Gemini   │──>│  Direct  │
   │   KNN     │      │  Pattern  │        │ PreAnalyze│   │ Extract  │
   │  Search   │      │  (>85%)   │        │  (DOM)    │   │Stagehand │
   └───────────┘      └─────┬─────┘        └───────────┘   └────┬─────┘
                            │ hit                                │ fail
                            ▼                                    ▼
   5. OBSERVE          4. LEARN               3b. RECOVERY
   ┌───────────┐      ┌───────────┐           ┌───────────┐
   │  Weave    │<─────│  Store    │<──────────│  Multi-   │
   │  Trace    │      │  Vector   │           │ Strategy  │
   │  + Score  │      │ Embedding │           │ Adaptive  │
   │  + Eval   │      └───────────┘           └───────────┘
   └───────────┘
```

| Stage | What Happens | Code |
|-------|-------------|------|
| **1. Vector Search** | KNN query against 1536-dimensional HNSW index in Redis. Query text is `{url_pattern} {target}`. Returns top 10 candidates ranked by cosine similarity. | [`vectors.ts`](webscout/src/lib/redis/vectors.ts) |
| **2. Cached Pattern** | Re-rank candidates by composite score (`similarity × 0.6 + fitness × 0.4`). If the best match exceeds the dynamic confidence threshold, replay the cached extraction approach. | [`scraper.ts`](webscout/src/lib/engine/scraper.ts) |
| **3. Gemini Pre-Analysis** | Before fresh extraction, optionally send a DOM snapshot to Google Gemini for structural analysis. Gemini suggests CSS selectors and extraction strategy. | [`gemini.ts`](webscout/src/lib/ai/gemini.ts) |
| **3a. Fresh Extraction** | No confident cache hit — Browserbase launches an isolated cloud browser, Stagehand AI extracts structured data from the live page. | [`stagehand-client.ts`](webscout/src/lib/browser/stagehand-client.ts) |
| **3b. Recovery** | If extraction fails, deploy up to 4 recovery strategies in adaptive order based on per-domain success rates. | [`recovery.ts`](webscout/src/lib/engine/recovery.ts) |
| **4. Learn** | Store successful patterns as 1536-dim vector embeddings. Update fitness scores. Record strategy outcomes. Adjust confidence threshold. | [`pattern-extractor.ts`](webscout/src/lib/engine/pattern-extractor.ts) |
| **5. Observe** | Every operation traced in Weave with structured summaries. Attach 4 retrospective feedback scores. Log evaluation predictions. | [`weave.ts`](webscout/src/lib/tracing/weave.ts) |

**The key insight:** This isn't a scraper with a cache bolted on. Every single task execution writes learning data back into the system. Successes reinforce pattern fitness. Failures increment failure counters and raise the confidence threshold. Recoveries store brand new patterns. The system literally cannot run without learning.

---

## Pattern Fitness Scoring

**Wilson Score Lower Bound + Exponential Time Decay**

> The same algorithm Reddit uses to rank comments, applied to extraction patterns.

Implemented in [`src/lib/engine/pattern-fitness.ts`](webscout/src/lib/engine/pattern-fitness.ts):

### The Math

**1. Wilson Score Lower Bound** (95% confidence interval)

```
p = success_count / total
z = 1.96
wilsonLower = (p + z²/2n - z√(p(1-p)/n + z²/4n²)) / (1 + z²/n)
```

This gives a statistically conservative estimate of the true success probability, properly penalizing patterns with few observations. A pattern with 3/3 successes ranks lower than one with 50/52 — because we have less confidence in the small sample.

**2. Exponential Time Decay** (30-day half-life)

```
decay = 0.5 ^ (daysSinceActivity / 30)
```

A pattern that worked 6 months ago on a site that's probably redesigned isn't worth much.

**3. Recency Bonus**

```
+0.15 if last success within 24 hours
+0.075 if last success within 7 days
```

**4. Composite Ranking**

```
fitness = clamp(0, 1, wilsonLower × decay + recencyBonus)
composite = vectorSimilarity × 0.6 + fitness × 0.4
```

Patterns compete on a composite of semantic similarity and fitness. The fittest, most similar pattern wins.

---

## Negative Learning — The System Actively Forgets

Most caching systems only remember successes. WebScout tracks failures too.

Implemented across [`vectors.ts`](webscout/src/lib/redis/vectors.ts), [`scraper.ts`](webscout/src/lib/engine/scraper.ts), and [`pattern-pruner.ts`](webscout/src/lib/engine/pattern-pruner.ts):

| Event | What Happens |
|-------|-------------|
| **Cached pattern succeeds** | `updatePatternLastSuccess()` increments `success_count`, timestamps `last_succeeded_at` |
| **Cached pattern fails** | `incrementPatternFailure()` increments `failure_count`, timestamps `last_failed_at` |
| **Fitness drops below 0.2** | Pattern is filtered from search results — it still exists but stops being used |
| **Fitness drops below 0.05 with 3+ failures** | Pattern pruner auto-removes it from Redis entirely |

If a pattern starts failing — maybe the site redesigned — its fitness score drops. Below 0.2 it gets filtered. Below 0.05 with 3+ failures it gets auto-pruned. **The system actively forgets what doesn't work anymore.**

---

## Dynamic Confidence Threshold

The confidence threshold for using cached patterns isn't static — it adjusts itself based on outcomes.

Implemented in [`src/lib/engine/pattern-extractor.ts`](webscout/src/lib/engine/pattern-extractor.ts):

```
Stored in Redis:  webscout:confidence_threshold
Range:            [0.70, 0.95]
Default:          0.85

On cache success:  threshold -= 0.005  (system gets bolder)
On cache failure:  threshold += 0.02   (system gets cautious)
```

**The asymmetry is deliberate.** Failures penalize 4x more than successes reward, because a false positive (using a bad cached pattern) is more expensive than a false negative (doing a fresh extraction when the cache would have worked). The threshold persists in Redis across deployments.

---

## Adaptive Recovery Ordering

Recovery isn't random. WebScout tracks per-domain success rates for each recovery strategy and reorders them accordingly — a multi-armed bandit approach.

Implemented in [`strategy-selector.ts`](webscout/src/lib/engine/strategy-selector.ts) and [`recovery.ts`](webscout/src/lib/engine/recovery.ts):

### The 4 Recovery Strategies

| # | Strategy | What It Does | Powered By |
|---|----------|-------------|-----------|
| 1 | **Agent** | Autonomous GPT-4o agent that reasons about the page, navigates complex flows, handles multi-step interactions | Stagehand `agent.execute()` |
| 2 | **Act** | Blocker removal — dismiss cookie banners, close modals, scroll past overlays, then re-extract | Stagehand `act()` |
| 3 | **Extract Refined** | Targeted extraction with enhanced hints about main content areas, sidebars, tables, metadata | Stagehand `extract()` with enriched instructions |
| 4 | **Gemini** | Google Gemini analyzes a DOM snapshot and suggests alternative CSS selectors for a completely different extraction approach | Gemini 2.0-flash |

### How Ordering Works

- Per-domain stats stored in Redis: `strategy_stats:{urlPattern}:{strategy}` containing `{attempts, successes, avg_duration_ms}`
- After each recovery attempt: `recordStrategyOutcome()` updates stats with a running average for duration
- Before recovery: `getOrderedStrategies()` sorts by success rate (descending), breaking ties by average duration (ascending)
- If agent-mode recovery works 80% of the time on Amazon but only 20% on Wikipedia, the system learns that and reorders accordingly

---

## Vector Similarity Search

Pattern matching is semantic, not keyword-based.

Implemented in [`src/lib/redis/vectors.ts`](webscout/src/lib/redis/vectors.ts):

### How It Works

1. Every URL pattern and target description is embedded into a **1536-dimensional vector** using OpenAI `text-embedding-3-small`
2. Vectors are stored in a **Redis HNSW index** (`idx:page_patterns`) with cosine distance metric
3. On each task, the query text `{url_pattern} {target}` is embedded and searched via **KNN**:
   ```
   *=>[KNN {topK} @embedding $BLOB AS vector_score]
   ```
4. Score normalization: `similarity = 1 - vectorScore / 2`

### Why This Matters

If you teach WebScout to extract prices from `amazon.com/products`, and a new task comes in for `amazon.com/electronics`, the vector search finds that pattern because the **semantic meaning is similar** — not because the strings match. This is what makes the learning generalizable.

### Index Schema

```
TEXT:     url_pattern, target, working_selector
TAG:      approach
NUMERIC:  created_at, success_count, failure_count, last_succeeded_at, last_failed_at
VECTOR:   embedding (HNSW, FLOAT32, 1536 dims, COSINE)
```

---

## Weave Integration — 7 Levels Deep

This isn't `weave.init()` and done. The entire feedback loop flows through Weave.

Implemented in [`src/lib/tracing/weave.ts`](webscout/src/lib/tracing/weave.ts) and [`src/lib/evaluation/`](webscout/src/lib/evaluation/):

### Level 1: Traced Operations

Every meaningful function is a `weave.op()` with custom `summarize()` callbacks that return structured metrics:

| Operation | Metrics Returned |
|-----------|-----------------|
| `learningScrape` | `success`, `used_cache`, `recovery_attempted`, `recovery_succeeded`, `pattern_learned`, `quality_score`, `duration_ms`, `steps_count` |
| `attemptRecovery` | `recovery_success`, `recovery_strategy` |
| `pruneDeadPatterns` | `patterns_pruned`, `patterns_remaining` |
| `searchSimilarPatterns` | Match count, top similarity scores |
| `storePattern` | Pattern ID, selector used |
| `adjustConfidenceThreshold` | New threshold value, direction |

### Level 2: Invoke + Call ID Capture

`learningScrape` uses `createInvocableOp()` so the API route can call `.invoke()` and get back `[result, Call]`. The `Call.id` is captured for attaching retrospective feedback.

### Level 3: Retrospective Feedback via Trace Server API

After every task, `addScoreToCall()` attaches **4 scores** to the Weave call using `traceServerApi.feedback.feedbackCreateFeedbackCreatePost()` — the raw feedback endpoint:

| Score Key | Type | Description |
|-----------|------|-------------|
| `webscout.success` | boolean (0/1) | Did the extraction succeed? |
| `webscout.quality` | 0-100 | GPT-4o quality assessment with comment |
| `webscout.used_cache` | boolean | Was a cached pattern used? |
| `webscout.recovery_needed` | boolean | Did recovery strategies fire? |

### Level 4: Pattern Dataset Versioning

`savePatternDataset()` creates a versioned `weave.Dataset` named `"webscout-learned-patterns"`. Each save creates a new version so you can track pattern evolution over time in the Weave UI.

### Level 5: Weave Images

`createWeaveImage(base64)` converts browser screenshots to `weave.weaveImage()` format. Screenshots appear **inline in the Weave trace UI** — you can see exactly what the agent saw at each step.

### Level 6: Formal Weave Evaluation (Batch)

4 typed scorers as `weave.op()`:

| Scorer | Logic |
|--------|-------|
| `webscout.scorer.success` | Binary success/fail |
| `webscout.scorer.speed` | Linear scale: ≤3s = 1.0, ≥60s = 0.0 |
| `webscout.scorer.cache_efficiency` | 1.0 cached, 0.5 fresh, 0.25 recovery |
| `webscout.scorer.quality` | Normalized extraction quality 0-1 |

A `replayModel` replays historical task results as a Weave model, and `weave.Evaluation` runs with a `weave.Dataset` built from task history.

### Level 7: Context Propagation

`withWeaveAttributes()` propagates `taskId`, `urlPattern`, `target`, and `sessionType` to all child spans. This enables filtering in the Weave UI by any dimension.

---

## Redis Architecture — 6 Key Patterns

Redis isn't just a cache — it's the **entire learning state**. The system picks up exactly where it left off across restarts and deployments.

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `pattern:{uuid}` | Hash | Stored pattern with embedding, selector, fitness fields, success/failure counts |
| `idx:page_patterns` | RediSearch Index | HNSW vector index over pattern hashes for KNN cosine similarity search |
| `task:{id}` | Hash | Full task data including steps, screenshots, results, metadata |
| `tasks:timeline` | Sorted Set | Task IDs scored by creation time for chronological listing |
| `strategy_stats:{urlPattern}:{strategy}` | Hash | Per-domain strategy success rates: `{attempts, successes, avg_duration_ms}` |
| `webscout:confidence_threshold` | String | Dynamic confidence threshold value (0.70-0.95) |

---

## Real-Time SSE Streaming

When you submit a task, the dashboard shows every step as it happens.

### Server ([`api/tasks/[id]/stream/route.ts`](webscout/src/app/api/tasks/%5Bid%5D/stream/route.ts))

- `ReadableStream` with `TextEncoder`
- Polls Redis every 500ms for step updates
- 120-second safety timeout
- Named events: `done` (task complete), `error` (server error)

### Client ([`hooks/use-task-stream.ts`](webscout/src/hooks/use-task-stream.ts))

- Native `EventSource` API with auto-reconnect
- Preserves last known state on transient errors — no UI flicker
- Updates step-by-step: each extraction attempt, each recovery strategy, each pattern learned

### Progress Flushing

The scraper calls `flushProgress()` after every significant step, writing intermediate state to Redis via `updateTaskProgress()`. This means the SSE stream picks up steps in near real-time even while the scraper is still working.

---

## Quality Assessment

Every successful extraction gets a quality score — not just pass/fail.

Implemented in [`src/lib/ai/openai-quality.ts`](webscout/src/lib/ai/openai-quality.ts):

- After every successful extraction: `assessExtractionQuality()` calls GPT-4o
- Returns a **0-100 quality score** with a text summary
- Score is attached to the Weave call as retrospective feedback
- Used in the evaluation pipeline with **20% weight** in the overall improvement score
- Enables distinguishing between "it extracted something" and "it extracted the right thing well"

---

## Cohort-Based Improvement Measurement

WebScout proves improvement quantitatively. No claims without data.

Implemented in [`src/lib/evaluation/batch-eval.ts`](webscout/src/lib/evaluation/batch-eval.ts) and [`/api/evaluation`](webscout/src/app/api/evaluation/route.ts):

### How It Works

1. Split all tasks chronologically into **thirds**: early, middle, late
2. Compute **6 metrics per cohort**: `success_rate`, `avg_duration`, `cache_hit_rate`, `recovery_rate`, `avg_quality_score`, `task_count`
3. Compute deltas between early and late cohorts

### Overall Improvement Score

Weighted average across four dimensions:

| Dimension | Weight |
|-----------|--------|
| Success Rate | 30% |
| Speed | 25% |
| Cache Efficiency | 25% |
| Quality | 20% |

### Letter Grades

| Grade | Score |
|-------|-------|
| **A** | ≥ 70 |
| **B** | ≥ 50 |
| **C** | ≥ 30 |
| **D** | < 30 |

Speed factor is calculated as the ratio of early/late average duration. After enough tasks, you can literally watch the grade climb from D to A as the system learns. **This isn't a claim — it's measured.**

### Measured Results

| Metric | Early Tasks | Recent Tasks | Improvement |
|--------|------------|--------------|-------------|
| **Success Rate** | 86% | 100% | +17% |
| **Extraction Speed** | 10.1s | 2.7s | **3.7x faster** |
| **Cache Hit Rate** | 14% | 83% | **+69pp** |
| **Recovery Needed** | 86% | 17% | **-81%** |

---

## Gemini Pre-Analysis

A second AI opinion before committing to an extraction strategy.

Implemented in [`src/lib/ai/gemini.ts`](webscout/src/lib/ai/gemini.ts):

| Function | When | What |
|----------|------|------|
| `geminiAnalyzePage()` | Before fresh extraction | Sends DOM snapshot to Gemini. Returns suggested CSS selectors, extraction strategy, and reasoning. |
| `getGeminiRecoveryStrategy()` | During recovery | Analyzes why the previous attempt failed. Suggests alternative selectors for a different approach. |

Gemini suggestions are appended as hints to the Stagehand extraction instruction, improving first-attempt success rates.

---

## Browserbase + Stagehand

Cloud browser infrastructure with three levels of AI interaction.

### Browserbase

- Every task runs in an **isolated cloud browser session** with a debuggable live URL
- Session URLs are captured and stored with the task for real-time viewing and post-mortem debugging
- Managed by [`src/lib/browser/session.ts`](webscout/src/lib/browser/session.ts)

### Stagehand APIs

| Method | Level | Usage |
|--------|-------|-------|
| `stagehand.extract()` | Structured extraction | AI-powered data extraction with Zod schemas — the primary extraction path |
| `stagehand.act()` | Browser actions | Click consent buttons, dismiss overlays, scroll, navigate — used in blocker removal recovery |
| `stagehand.agent.execute()` | Autonomous reasoning | Full GPT-4o agent that reasons about the page, handles multi-step flows — the most powerful recovery strategy |
| `page.goto()`, `page.screenshot()`, `page.evaluate()` | Standard control | Navigation, screenshot capture, DOM evaluation |

The recovery pipeline chains all three levels: try `extract`, then `act` to remove blockers, then `extract` with refined hints, then `agent` for autonomous reasoning.

---

## Architecture

```
                    ┌──────────────────────────────────────────────────┐
                    │                WebScout Dashboard                │
                    │                                                  │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
                    │  │ Live View│ │Evaluation│ │ Teaching │        │
                    │  │ (SSE)    │ │ (Cohorts)│ │ (Manual) │        │
                    │  └──────────┘ └──────────┘ └──────────┘        │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
                    │  │ Patterns │ │  Tasks   │ │ Timeline │        │
                    │  │ (Browse) │ │ (Manage) │ │ (Trace)  │        │
                    │  └──────────┘ └──────────┘ └──────────┘        │
                    └──────────────────────┬───────────────────────────┘
                                          │ Next.js API Routes
                    ┌─────────────────────▼────────────────────────────┐
                    │              Learning Engine                      │
                    │                                                   │
                    │  Vector Search ──> Pattern Match ──> Extract      │
                    │       ↑                                  │        │
                    │       │         Gemini Pre-Analysis       │        │
                    │       │              ↓                    ↓        │
                    │       └──── Pattern Store ◄──── Recovery  │        │
                    │                    ↑                 ↑    │        │
                    │                    │    Strategy     │    │        │
                    │                    │    Selector     │    │        │
                    │                    └─────────────────┘    │        │
                    │                                          │        │
                    │  Pattern Fitness ←── Negative Learning    │        │
                    │  Confidence Threshold ←── Asymmetric Adj  │        │
                    └───────┬──────────┬──────────┬────────────┘
                            │          │          │
                     ┌──────▼───┐ ┌───▼─────┐ ┌──▼──────────┐
                     │  Redis    │ │Browser- │ │   Weave     │
                     │  Stack    │ │  base   │ │             │
                     │           │ │         │ │ 7-Level     │
                     │ • Vectors │ │ • Cloud │ │ Integration │
                     │ • HNSW    │ │   Browser│ │             │
                     │ • Patterns│ │ • Stage- │ │ • Traces    │
                     │ • Tasks   │ │   hand   │ │ • Feedback  │
                     │ • Stats   │ │ • Live   │ │ • Datasets  │
                     │ • Thresh. │ │   URLs   │ │ • Evals     │
                     └───────────┘ └─────────┘ └─────────────┘
                            │          │          │
                     ┌──────▼───┐ ┌───▼─────┐ ┌──▼──────────┐
                     │  OpenAI   │ │ Google  │ │  Vercel     │
                     │           │ │ Gemini  │ │             │
                     │ • Embed   │ │         │ │ • Next.js   │
                     │   3-small │ │ • Pre-  │ │ • SSE       │
                     │ • GPT-4o  │ │  analyze│ │ • Edge      │
                     │   quality │ │ • Recov.│ │             │
                     └───────────┘ └─────────┘ └─────────────┘
```

---

## Dashboard

### Pages

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Task submission form + quick stats overview |
| **Dashboard** | `/dashboard` | Main dashboard with stats, learning curve chart, recent tasks |
| **Live View** | `/live` | Real-time browser session viewer via Browserbase — watch the agent work |
| **Tasks** | `/tasks` | Task list with status, duration, cache/recovery indicators |
| **Task Detail** | `/tasks/[id]` | Full execution log with step-by-step trace, screenshots, timeline |
| **Patterns** | `/patterns` | Pattern library — browse all learned extraction patterns with fitness scores |
| **Evaluation** | `/evaluation` | Cohort-based improvement metrics, letter grades, learning curves |
| **Teach** | `/teach` | Manual teaching mode — teach extraction patterns for specific sites |

### Key Components

| Component | What It Does |
|-----------|-------------|
| `learning-curve.tsx` | Recharts visualization of speed and accuracy improvement over time |
| `improvement-report.tsx` | Cohort comparison with delta calculations and overall grade |
| `trace-timeline.tsx` | Step-by-step execution trace with screenshots and timing |
| `pattern-card.tsx` | Pattern display with fitness score, success/failure counts, selector preview |
| `live-session-viewer.tsx` | Embedded Browserbase session for real-time browser watching |
| `stats-overview.tsx` | Aggregate metrics: total tasks, success rate, avg duration, cache hit rate |

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Framework** | Next.js 15, React 19, TypeScript 5 | App Router with serverless API routes and SSE streaming |
| **Styling** | Tailwind CSS v4, shadcn/ui | Responsive dashboard UI |
| **Browser Automation** | Browserbase SDK + Stagehand v3 | Cloud browser sessions with AI extraction, actions, and agent reasoning |
| **AI — Extraction** | OpenAI GPT-4o (via Stagehand) | Primary extraction engine and autonomous recovery agent |
| **AI — Embeddings** | OpenAI text-embedding-3-small | 1536-dim semantic vectors for pattern matching |
| **AI — Quality** | OpenAI GPT-4o | 0-100 quality assessment of extraction results |
| **AI — Analysis** | Google Gemini 2.0-flash | DOM pre-analysis and recovery strategy suggestions |
| **Storage & Search** | Redis Stack + RediSearch | HNSW vector index, hash storage, sorted sets, strategy stats |
| **Observability** | Weave (Weights & Biases) | 7-level integration: traces, feedback, datasets, evaluations, images |
| **Charts** | Recharts | Learning curves, cohort comparisons, improvement visualizations |
| **Deployment** | Vercel | Edge-optimized Next.js deployment |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Redis Stack** (with RediSearch module for vector search)
- **API Keys**: Browserbase, OpenAI, Weights & Biases, Google AI

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

# Start Redis Stack
docker compose up -d
# Or install locally: brew install redis-stack && redis-stack-server &

# Run the development server
npm run dev

# Seed demo data (optional — populates example tasks and patterns)
curl -X POST http://localhost:3000/api/demo/seed
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Environment Variables

```env
# Browserbase — Cloud browser infrastructure
BROWSERBASE_API_KEY=           # browserbase.com/settings
BROWSERBASE_PROJECT_ID=        # Browserbase dashboard

# OpenAI — Embeddings, quality assessment, extraction (via Stagehand)
OPENAI_API_KEY=                # platform.openai.com/api-keys

# Redis — Vector search + learning state
REDIS_URL=                     # Default: redis://localhost:6379

# Weights & Biases — Weave observability
WANDB_API_KEY=                 # wandb.ai/authorize
WEAVE_PROJECT=                 # Default: webscout

# Google AI — Gemini pre-analysis and recovery
GOOGLE_AI_API_KEY=             # aistudio.google.com/apikey
```

### Docker Compose (Redis Stack)

The included `docker-compose.yml` starts Redis Stack with RediSearch:

```bash
docker compose up -d
```

This provides Redis with the RediSearch module needed for HNSW vector indexing.

---

## Project Structure

```
webscout/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Home — task submission
│   │   ├── dashboard/page.tsx        # Main dashboard
│   │   ├── live/page.tsx             # Real-time browser view
│   │   ├── tasks/page.tsx            # Task list
│   │   ├── tasks/[id]/page.tsx       # Task detail + execution log
│   │   ├── patterns/page.tsx         # Pattern library
│   │   ├── evaluation/page.tsx       # Improvement metrics
│   │   ├── teach/page.tsx            # Manual teaching mode
│   │   └── api/
│   │       ├── tasks/route.ts        # POST: submit task, GET: list tasks
│   │       ├── tasks/[id]/route.ts   # GET: task detail
│   │       ├── tasks/[id]/stream/    # SSE: real-time task updates
│   │       ├── patterns/route.ts     # GET: list learned patterns
│   │       ├── evaluation/route.ts   # GET: cohort metrics
│   │       ├── evaluation/batch/     # POST: run formal Weave evaluation
│   │       ├── teach/route.ts        # POST: manually teach a pattern
│   │       ├── health/route.ts       # GET: service health checks
│   │       ├── metrics/route.ts      # GET: aggregate metrics
│   │       ├── timeline/route.ts     # GET: task timeline
│   │       └── demo/
│   │           ├── seed/route.ts     # POST: seed demo data
│   │           └── reset/route.ts    # POST: clear all data
│   │
│   ├── lib/
│   │   ├── engine/                   # Core learning engine
│   │   │   ├── scraper.ts            # THE learning loop — learningScrape()
│   │   │   ├── recovery.ts           # Multi-strategy recovery pipeline
│   │   │   ├── pattern-fitness.ts    # Wilson Score + time decay
│   │   │   ├── pattern-extractor.ts  # Pattern storage + confidence threshold
│   │   │   ├── pattern-pruner.ts     # Auto-remove dead patterns
│   │   │   └── strategy-selector.ts  # Adaptive recovery ordering
│   │   │
│   │   ├── redis/                    # Redis integration
│   │   │   ├── client.ts             # Redis connection management
│   │   │   ├── vectors.ts            # HNSW vector search + pattern CRUD
│   │   │   ├── patterns.ts           # Pattern listing + queries
│   │   │   └── tasks.ts              # Task storage + progress updates
│   │   │
│   │   ├── browser/                  # Browser automation
│   │   │   ├── stagehand-client.ts   # Stagehand initialization
│   │   │   └── session.ts            # Browserbase session management
│   │   │
│   │   ├── ai/                       # AI integrations
│   │   │   ├── gemini.ts             # Gemini pre-analysis + recovery
│   │   │   └── openai-quality.ts     # GPT-4o quality assessment
│   │   │
│   │   ├── embeddings/               # Vector embeddings
│   │   │   └── openai.ts             # text-embedding-3-small
│   │   │
│   │   ├── tracing/                  # Observability
│   │   │   ├── weave.ts              # Weave ops, invoke, feedback, datasets
│   │   │   └── trace-context.ts      # Screenshots + DOM snapshots
│   │   │
│   │   ├── evaluation/               # Improvement measurement
│   │   │   ├── batch-eval.ts         # Formal Weave evaluation with scorers
│   │   │   └── weave-eval-logger.ts  # Log predictions for evaluation
│   │   │
│   │   └── utils/
│   │       ├── types.ts              # TypeScript type definitions
│   │       └── url.ts                # URL pattern utilities
│   │
│   ├── components/                   # React UI
│   │   ├── task-form.tsx             # Task submission form
│   │   ├── task-list.tsx             # Task list with filters
│   │   ├── execution-log.tsx         # Step-by-step execution viewer
│   │   ├── trace-timeline.tsx        # Visual timeline of agent decisions
│   │   ├── learning-timeline.tsx     # Learning event timeline
│   │   ├── learning-curve.tsx        # Recharts improvement charts
│   │   ├── improvement-report.tsx    # Cohort comparison + grades
│   │   ├── pattern-card.tsx          # Pattern display card
│   │   ├── pattern-grid.tsx          # Pattern library grid
│   │   ├── stats-overview.tsx        # Aggregate statistics
│   │   ├── live-session-viewer.tsx   # Browserbase live session embed
│   │   ├── empty-state.tsx           # Empty state placeholder
│   │   └── ui/                       # shadcn/ui primitives
│   │
│   └── hooks/                        # React hooks
│       ├── use-task-stream.ts        # SSE connection for live updates
│       ├── use-tasks.ts              # Task CRUD operations
│       ├── use-patterns.ts           # Pattern fetching
│       ├── use-evaluation.ts         # Evaluation data fetching
│       ├── use-metrics.ts            # Aggregate metrics
│       ├── use-live-task.ts          # Live task tracking
│       ├── use-teach.ts              # Teaching mode
│       └── use-timeline.ts           # Timeline data
│
├── docker-compose.yml                # Redis Stack
├── package.json
└── tsconfig.json
```

---

## API Reference

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tasks` | Submit a new scraping task. Body: `{ url, target, instruction? }`. Returns task ID immediately, executes async. |
| `GET` | `/api/tasks` | List all tasks with stats. Query: `?limit=50` |
| `GET` | `/api/tasks/[id]` | Get full task detail including steps and screenshots |
| `GET` | `/api/tasks/[id]/stream` | SSE stream of real-time task progress |

### Patterns

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patterns` | List all learned patterns with fitness scores |

### Evaluation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/evaluation` | Cohort-based improvement metrics with letter grade |
| `POST` | `/api/evaluation/batch` | Run formal Weave evaluation with all 4 scorers |

### Teaching

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/teach` | Manually teach an extraction pattern. Body: `{ url, target, selector, approach }` |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health checks for Redis, Browserbase, Weave, AI models |
| `GET` | `/api/metrics` | Aggregate metrics: total tasks, success rate, cache rate |
| `GET` | `/api/timeline` | Task timeline for dashboard visualization |
| `POST` | `/api/demo/seed` | Seed demo data for showcasing |
| `POST` | `/api/demo/reset` | Clear all data: tasks, patterns, strategy stats, threshold |

---

## Sponsor Integrations

### Weave (Weights & Biases)

Seven integration levels: traced ops with structured summaries, invoke for call ID capture, retrospective feedback via trace server API, versioned pattern datasets, inline screenshot images, formal Evaluations with typed scorers, and attribute-based context propagation.

**Key files:** [`weave.ts`](webscout/src/lib/tracing/weave.ts), [`trace-context.ts`](webscout/src/lib/tracing/trace-context.ts), [`batch-eval.ts`](webscout/src/lib/evaluation/batch-eval.ts), [`weave-eval-logger.ts`](webscout/src/lib/evaluation/weave-eval-logger.ts)

### Redis

Six key patterns: HNSW vector index for 1536-dim KNN search, pattern hashes with fitness fields, sorted set task timeline, per-domain strategy stats, and a dynamic confidence threshold. All learning state lives in Redis.

**Key files:** [`vectors.ts`](webscout/src/lib/redis/vectors.ts), [`client.ts`](webscout/src/lib/redis/client.ts), [`tasks.ts`](webscout/src/lib/redis/tasks.ts), [`patterns.ts`](webscout/src/lib/redis/patterns.ts)

### Browserbase

Cloud browser sessions with live debuggable URLs. Every task runs in an isolated managed browser — no local Chrome needed.

**Key files:** [`session.ts`](webscout/src/lib/browser/session.ts), [`stagehand-client.ts`](webscout/src/lib/browser/stagehand-client.ts)

### Stagehand

Three interaction modes: `extract` for structured data, `act` for browser actions, `agent` for autonomous GPT-4o reasoning. The recovery pipeline chains all three.

**Key files:** [`scraper.ts`](webscout/src/lib/engine/scraper.ts), [`recovery.ts`](webscout/src/lib/engine/recovery.ts)

### OpenAI

`text-embedding-3-small` for 1536-dim semantic pattern embeddings. GPT-4o for quality assessment scoring 0-100.

**Key files:** [`openai.ts`](webscout/src/lib/embeddings/openai.ts), [`openai-quality.ts`](webscout/src/lib/ai/openai-quality.ts)

### Google Gemini

DOM pre-analysis before extraction and recovery strategy suggestions when primary extraction fails.

**Key files:** [`gemini.ts`](webscout/src/lib/ai/gemini.ts)

### Vercel

Next.js App Router with serverless API routes, SSE streaming, and edge-optimized deployment.

---

## License

MIT

---

<div align="center">

**WebScout** — Built for [WeaveHacks 3](https://lu.ma/weavehacks3)

*Every failed click makes it smarter.*

Powered by [Weave](https://wandb.ai/site/weave) | [Browserbase](https://www.browserbase.com/) | [Redis](https://redis.io/) | [Gemini](https://ai.google.dev/) | [Vercel](https://vercel.com)

</div>
