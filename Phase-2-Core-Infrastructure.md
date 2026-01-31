# Phase 2: Core Infrastructure — Redis Vectors, Embeddings, Weave

## Phase Overview

**Goal:** Build all foundational services: Redis vector index, OpenAI embeddings, Weave tracing, shared types, URL utilities, and data storage.

**Dependencies:** Phase 1 complete (Next.js running, Redis connected, deps installed)

**Produces:**
- Shared TypeScript type definitions
- URL normalization utilities
- Redis client singleton with auto-reconnect
- OpenAI embedding service (text-embedding-3-small, 1536 dims)
- Redis vector index (HNSW) with KNN search and pattern storage
- Pattern and task CRUD operations
- Weave tracing setup with `weave.op` wrappers
- Screenshot and DOM capture utilities

---

## Step 2.1: Shared TypeScript Types

**File: `src/lib/utils/types.ts`**

```typescript
// ============================================
// WebScout Shared Types
// ============================================

export interface PagePattern {
  id: string;
  url_pattern: string;
  target: string;
  working_selector: string;
  approach: "extract" | "act" | "agent";
  created_at: number;
  success_count: number;
  score?: number; // similarity score from vector search (0-1, higher = more similar)
}

export interface TaskRequest {
  url: string;
  target: string; // what to extract, e.g., "product price and title"
}

export interface TaskResult {
  id: string;
  url: string;
  target: string;
  status: "pending" | "running" | "success" | "failed";
  result: any;
  used_cached_pattern: boolean;
  recovery_attempted: boolean;
  pattern_id?: string;
  trace_id?: string;
  screenshots: string[]; // base64-encoded PNG screenshots
  steps: TaskStep[];
  created_at: number;
  completed_at?: number;
}

export interface TaskStep {
  action: string;
  status: "success" | "failure" | "recovery" | "info";
  detail: string;
  screenshot?: string; // base64
  dom_snapshot?: string;
  timestamp: number;
}

export interface RecoveryResult {
  success: boolean;
  result: any;
  strategy_used: "agent" | "act" | "extract_refined";
  working_selector: string;
  screenshot?: string;
}

export interface PatternData {
  url_pattern: string;
  target: string;
  working_selector: string;
  approach: "extract" | "act" | "agent";
}

export interface TaskStats {
  total: number;
  successful: number;
  failed: number;
  cached: number;
  recovered: number;
  patterns_learned: number;
  cache_hit_rate: string;
  recovery_rate: string;
}
```

---

## Step 2.2: URL Normalization Utilities

**File: `src/lib/utils/url.ts`**

```typescript
/**
 * Convert specific URLs into reusable patterns.
 * e.g., "https://www.amazon.com/dp/B09V3KXJPB?ref=foo" → "amazon.com/dp/*"
 */
export function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.replace(/^www\./, "");

    let pathSegments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        if (/^[a-f0-9-]{8,}$/i.test(segment)) return "*";       // UUIDs, hex IDs
        if (/^\d{4,}$/.test(segment)) return "*";                 // Numeric IDs (4+ digits)
        if (/^B[A-Z0-9]{9}$/.test(segment)) return "*";           // Amazon ASINs
        if (/^[a-z0-9_-]+_\d+$/i.test(segment)) return "*";      // slug_123 patterns
        return segment;
      });

    return `${hostname}/${pathSegments.join("/")}`;
  } catch {
    return url;
  }
}

/**
 * Strip tracking parameters from URLs.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "ref_", "tag", "source", "fbclid", "gclid", "mc_cid", "mc_eid",
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}
```

---

## Step 2.3: Redis Client Singleton

**File: `src/lib/redis/client.ts`**

```typescript
import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectionPromise: Promise<RedisClient> | null = null;

/**
 * Get or create a Redis client singleton.
 * Auto-connects on first call. Reuses the same connection.
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (client && client.isOpen) {
    return client;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    client.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    client.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    await client.connect();
    console.log("[Redis] Connected successfully");
    connectionPromise = null;
    return client;
  })();

  return connectionPromise;
}

export async function disconnectRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.disconnect();
    client = null;
  }
}
```

---

## Step 2.4: OpenAI Embedding Service

**File: `src/lib/embeddings/openai.ts`**

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a 1536-dimensional embedding vector.
 * Uses OpenAI text-embedding-3-small model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim().substring(0, 8000), // max token safety
  });
  return response.data[0].embedding;
}

/**
 * Batch embedding generation.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.trim().substring(0, 8000)),
  });
  return response.data.map((d) => d.embedding);
}
```

**Key details:**
- Model: `text-embedding-3-small` → 1536 dimensions
- Distance metric: COSINE (lower distance = more similar)
- Cost: ~$0.02 per 1M tokens (very cheap)
- Max input: 8191 tokens

---

## Step 2.5: Redis Vector Index & Search (CRITICAL FILE)

**File: `src/lib/redis/vectors.ts`**

This is one of the most critical files — it powers the "learning" capability.

```typescript
import { SchemaFieldTypes, VectorAlgorithms } from "redis";
import { getRedisClient } from "./client";
import { generateEmbedding } from "../embeddings/openai";
import type { PatternData, PagePattern } from "../utils/types";

const INDEX_NAME = "idx:page_patterns";
const PREFIX = "pattern:";
const VECTOR_DIM = 1536; // text-embedding-3-small

// ============================================
// Index Management
// ============================================

/**
 * Create the RediSearch vector index if it doesn't exist.
 * Uses HNSW algorithm with COSINE distance for 1536-dim vectors.
 *
 * Schema:
 *   url_pattern  TEXT    — normalized URL pattern (e.g., "amazon.com/dp/*")
 *   target       TEXT    — extraction target (e.g., "product price")
 *   working_selector TEXT — the instruction/selector that worked
 *   approach     TAG     — "extract" | "act" | "agent"
 *   created_at   NUMERIC — Unix timestamp
 *   success_count NUMERIC — how many times this pattern was reused
 *   embedding    VECTOR  — 1536-dim HNSW, COSINE distance
 */
export async function ensureVectorIndex(): Promise<void> {
  const client = await getRedisClient();

  try {
    await client.ft.info(INDEX_NAME);
    // Index already exists
  } catch {
    // Index doesn't exist — create it
    console.log("[Redis] Creating vector index:", INDEX_NAME);

    await client.ft.create(
      INDEX_NAME,
      {
        url_pattern: { type: SchemaFieldTypes.TEXT, SORTABLE: true },
        target: { type: SchemaFieldTypes.TEXT },
        working_selector: { type: SchemaFieldTypes.TEXT },
        approach: { type: SchemaFieldTypes.TAG },
        created_at: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
        success_count: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
        embedding: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: VectorAlgorithms.HNSW,
          TYPE: "FLOAT32",
          DIM: VECTOR_DIM,
          DISTANCE_METRIC: "COSINE",
        },
      },
      { ON: "HASH", PREFIX: PREFIX }
    );

    console.log("[Redis] Vector index created successfully");
  }
}

// ============================================
// Vector Search — Find Similar Patterns
// ============================================

/**
 * Search for patterns similar to the query using KNN vector search.
 *
 * How it works:
 * 1. Generate embedding for the query text (URL pattern + target)
 * 2. Convert to binary Buffer (Float32Array)
 * 3. Run KNN search: find K nearest neighbors by cosine distance
 * 4. Parse results into PagePattern[] with similarity scores
 *
 * COSINE distance: 0 = identical, 2 = opposite
 * We convert to similarity: 1 - (distance/2), so 1.0 = identical, 0.0 = opposite
 */
export async function searchSimilarPatterns(
  queryText: string,
  topK: number = 3
): Promise<PagePattern[]> {
  const client = await getRedisClient();
  const embedding = await generateEmbedding(queryText);
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  try {
    const results = await client.ft.search(
      INDEX_NAME,
      `*=>[KNN ${topK} @embedding $BLOB AS vector_score]`,
      {
        PARAMS: { BLOB: embeddingBuffer },
        SORTBY: { BY: "vector_score", DIRECTION: "ASC" },
        DIALECT: 2,
        RETURN: [
          "url_pattern", "target", "working_selector",
          "approach", "vector_score", "success_count", "created_at",
        ],
      }
    );

    if (!results.documents || results.documents.length === 0) {
      return [];
    }

    return results.documents.map((doc) => ({
      id: doc.id,
      url_pattern: doc.value.url_pattern as string,
      target: doc.value.target as string,
      working_selector: doc.value.working_selector as string,
      approach: doc.value.approach as "extract" | "act" | "agent",
      success_count: parseInt(doc.value.success_count as string, 10) || 0,
      created_at: parseInt(doc.value.created_at as string, 10) || 0,
      score: 1 - parseFloat(doc.value.vector_score as string) / 2,
    }));
  } catch (error) {
    console.error("[Redis] Vector search failed:", error);
    return [];
  }
}

// ============================================
// Store Pattern — Learn From Success/Recovery
// ============================================

/**
 * Store a learned pattern with its embedding vector.
 * Called after successful extraction or recovery.
 */
export async function storePattern(data: PatternData): Promise<string> {
  const client = await getRedisClient();

  const embeddingText = `${data.url_pattern} ${data.target}`;
  const embedding = await generateEmbedding(embeddingText);
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  const id = `${PREFIX}${crypto.randomUUID()}`;

  await client.hSet(id, {
    url_pattern: data.url_pattern,
    target: data.target,
    working_selector: data.working_selector,
    approach: data.approach,
    created_at: Date.now().toString(),
    success_count: "1",
    embedding: embeddingBuffer,
  });

  console.log(`[Redis] Stored pattern: ${id}`);
  return id;
}

/**
 * Increment success_count when a cached pattern is reused.
 */
export async function incrementPatternSuccess(patternId: string): Promise<void> {
  const client = await getRedisClient();
  await client.hIncrBy(patternId, "success_count", 1);
}
```

### How Vector Search Works

```
Query: "books.toscrape.com/catalogue/* book title and price"
                    ↓
           Generate embedding (1536 floats)
                    ↓
           Convert to Buffer (6144 bytes)
                    ↓
    FT.SEARCH idx:page_patterns "*=>[KNN 3 @embedding $BLOB AS score]"
                    ↓
         Redis HNSW index finds 3 nearest neighbors
                    ↓
    Results sorted by cosine distance (0 = identical)
                    ↓
         Convert distance to similarity (1 - dist/2)
                    ↓
    Return: [{ url_pattern, target, working_selector, score: 0.95 }]
```

---

## Step 2.6: Pattern CRUD Helpers

**File: `src/lib/redis/patterns.ts`**

```typescript
import { getRedisClient } from "./client";
import type { PagePattern } from "../utils/types";

/**
 * List all learned patterns, sorted by success_count DESC.
 */
export async function listPatterns(
  limit: number = 50,
  offset: number = 0
): Promise<{ patterns: PagePattern[]; total: number }> {
  const client = await getRedisClient();

  try {
    const results = await client.ft.search("idx:page_patterns", "*", {
      SORTBY: { BY: "success_count", DIRECTION: "DESC" },
      LIMIT: { from: offset, size: limit },
      RETURN: [
        "url_pattern", "target", "working_selector",
        "approach", "success_count", "created_at",
      ],
    });

    const patterns: PagePattern[] = results.documents.map((doc) => ({
      id: doc.id,
      url_pattern: doc.value.url_pattern as string,
      target: doc.value.target as string,
      working_selector: doc.value.working_selector as string,
      approach: doc.value.approach as "extract" | "act" | "agent",
      success_count: parseInt(doc.value.success_count as string, 10) || 0,
      created_at: parseInt(doc.value.created_at as string, 10) || 0,
    }));

    return { patterns, total: results.total };
  } catch (error) {
    console.error("[Redis] listPatterns failed:", error);
    return { patterns: [], total: 0 };
  }
}

export async function getPattern(patternId: string): Promise<PagePattern | null> {
  const client = await getRedisClient();
  const data = await client.hGetAll(patternId);
  if (!data || !data.url_pattern) return null;

  return {
    id: patternId,
    url_pattern: data.url_pattern,
    target: data.target,
    working_selector: data.working_selector,
    approach: data.approach as "extract" | "act" | "agent",
    success_count: parseInt(data.success_count, 10) || 0,
    created_at: parseInt(data.created_at, 10) || 0,
  };
}

export async function deletePattern(patternId: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(patternId);
}

export async function getPatternCount(): Promise<number> {
  const client = await getRedisClient();
  try {
    const info = await client.ft.info("idx:page_patterns");
    return info.numDocs ?? 0;
  } catch {
    return 0;
  }
}
```

---

## Step 2.7: Task Storage

**File: `src/lib/redis/tasks.ts`**

```typescript
import { getRedisClient } from "./client";
import type { TaskResult } from "../utils/types";

const TASK_PREFIX = "task:";

export async function storeTask(task: TaskResult): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${task.id}`;

  await client.hSet(key, {
    data: JSON.stringify(task),
    created_at: task.created_at.toString(),
    status: task.status,
  });

  // Sorted set for ordered listing (score = timestamp)
  await client.zAdd("tasks:timeline", {
    score: task.created_at,
    value: task.id,
  });
}

export async function getTask(taskId: string): Promise<TaskResult | null> {
  const client = await getRedisClient();
  const data = await client.hGet(`${TASK_PREFIX}${taskId}`, "data");
  if (!data) return null;
  return JSON.parse(data) as TaskResult;
}

export async function listTasks(
  limit: number = 20,
  offset: number = 0
): Promise<{ tasks: TaskResult[]; total: number }> {
  const client = await getRedisClient();

  const total = await client.zCard("tasks:timeline");
  const ids = await client.zRange("tasks:timeline", "+inf", "-inf", {
    BY: "SCORE",
    REV: true,
    LIMIT: { offset, count: limit },
  });

  const tasks: TaskResult[] = [];
  for (const id of ids) {
    const task = await getTask(id);
    if (task) tasks.push(task);
  }

  return { tasks, total };
}

export async function getTaskStats() {
  const { tasks } = await listTasks(1000, 0);
  return {
    total: tasks.length,
    successful: tasks.filter((t) => t.status === "success").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    cached: tasks.filter((t) => t.used_cached_pattern).length,
    recovered: tasks.filter(
      (t) => t.recovery_attempted && t.status === "success"
    ).length,
  };
}
```

---

## Step 2.8: Weave Tracing Setup

**File: `src/lib/tracing/weave.ts`**

```typescript
import * as weave from "weave";

let initialized = false;

/**
 * Initialize Weave tracing. Idempotent — safe to call multiple times.
 * If Weave fails to init, the app continues without tracing.
 */
export async function initWeave(): Promise<void> {
  if (initialized) return;

  try {
    await weave.init(process.env.WEAVE_PROJECT || "webscout");
    initialized = true;
    console.log("[Weave] Initialized successfully");
  } catch (error) {
    console.warn("[Weave] Failed to initialize:", (error as Error).message);
  }
}

/**
 * Wrap a function with Weave tracing (weave.op).
 * Falls back to the untraced function if Weave isn't available.
 *
 * Usage:
 *   const traced = createTracedOp("myFunction", async (arg) => { ... });
 */
export function createTracedOp<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  try {
    return weave.op(fn, { name }) as T;
  } catch {
    return fn;
  }
}

export { weave };
```

### Environment Setup for Weave

Weave uses the W&B API key. Set it in `.env.local`:
```
WANDB_API_KEY=your_key_here
WEAVE_PROJECT=webscout
```

Or in `~/.netrc`:
```
machine api.wandb.ai
  login user
  password YOUR_WANDB_API_KEY
```

---

## Step 2.9: Trace Context Utilities

**File: `src/lib/tracing/trace-context.ts`**

```typescript
import type { Page } from "playwright";

/**
 * Capture a screenshot from the browser page.
 * Returns base64-encoded PNG string.
 */
export async function captureScreenshot(page: Page): Promise<string> {
  try {
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return buffer.toString("base64");
  } catch (error) {
    console.warn("[Trace] Screenshot failed:", (error as Error).message);
    return "";
  }
}

/**
 * Capture simplified DOM snapshot for logging.
 */
export async function captureDOMSnapshot(page: Page): Promise<string> {
  try {
    const html = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "<empty>";
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return clone.innerHTML.substring(0, 5000);
    });
    return html;
  } catch (error) {
    console.warn("[Trace] DOM snapshot failed:", (error as Error).message);
    return "<unavailable>";
  }
}

export function buildStepMetadata(
  url: string,
  target: string,
  attempt: number,
  extras?: Record<string, any>
) {
  return { url, target, attempt, timestamp: Date.now(), ...extras };
}
```

---

## Step 2.10: Testing & Debugging

### Verify Each Module

```bash
# 1. Test Redis connection (health endpoint from Phase 1)
curl http://localhost:3000/api/health | jq .services.redis

# 2. Verify vector index creation (start the app, the index is created on first use)
docker exec webscout-redis redis-cli FT.INFO idx:page_patterns
# If index doesn't exist yet, that's OK — it's created on first scrape task

# 3. Type check all new files
npx tsc --noEmit

# 4. Build
npm run build
```

### Common Errors

| Error | Fix |
|-------|-----|
| `SchemaFieldTypes is not defined` | Ensure `redis` package is v4+ and import from `"redis"` |
| `VectorAlgorithms is not defined` | Same — needs `redis` v4.6+ |
| OpenAI rate limit | Implement retry logic or use a lower-cost embedding call |
| `Weave auth failed` | Check WANDB_API_KEY in .env.local or ~/.netrc |
| Redis index already exists | `ensureVectorIndex` handles this — it catches and ignores |

### Debug Checklist

- [ ] `src/lib/utils/types.ts` — All interfaces compile
- [ ] `src/lib/utils/url.ts` — extractUrlPattern works for test URLs
- [ ] `src/lib/redis/client.ts` — getRedisClient connects successfully
- [ ] `src/lib/embeddings/openai.ts` — generateEmbedding returns 1536 floats
- [ ] `src/lib/redis/vectors.ts` — ensureVectorIndex creates index
- [ ] `src/lib/redis/vectors.ts` — storePattern + searchSimilarPatterns round-trips
- [ ] `src/lib/redis/patterns.ts` — listPatterns returns data
- [ ] `src/lib/redis/tasks.ts` — storeTask + getTask round-trips
- [ ] `src/lib/tracing/weave.ts` — initWeave completes without error
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds

---

## Step 2.11: GitHub Workflow

**File: `.github/workflows/phase-2-infrastructure.yml`**

```yaml
name: Phase 2 - Infrastructure Tests

on: [push, pull_request]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
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

      - name: Install dependencies
        run: cd webscout && npm ci

      - name: TypeScript type check
        run: cd webscout && npx tsc --noEmit

      - name: Build
        run: cd webscout && npm run build

      - name: Verify Redis connectivity
        run: |
          redis-cli -h localhost -p 6379 ping
```

---

## File Checklist

| File | Description |
|------|-------------|
| `src/lib/utils/types.ts` | PagePattern, TaskRequest, TaskResult, TaskStep, etc. |
| `src/lib/utils/url.ts` | extractUrlPattern, normalizeUrl |
| `src/lib/redis/client.ts` | Redis client singleton |
| `src/lib/embeddings/openai.ts` | generateEmbedding (text-embedding-3-small) |
| `src/lib/redis/vectors.ts` | ensureVectorIndex, searchSimilarPatterns, storePattern |
| `src/lib/redis/patterns.ts` | listPatterns, getPattern, getPatternCount |
| `src/lib/redis/tasks.ts` | storeTask, getTask, listTasks, getTaskStats |
| `src/lib/tracing/weave.ts` | initWeave, createTracedOp |
| `src/lib/tracing/trace-context.ts` | captureScreenshot, captureDOMSnapshot |
| `.github/workflows/phase-2-infrastructure.yml` | CI with Redis Stack service |

**Total: 10 new files**

---

**Phase 2 Complete.** All foundational services are ready. **Next: Phase 3 — The Learning Scraper Engine.**
