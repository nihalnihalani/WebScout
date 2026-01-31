# WebScout - Browser Agent That Learns From Failures

## Complete Implementation Guide

> **Tagline:** "Every failed click makes it smarter"

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Phase 1: Project Scaffolding & Environment Setup](#phase-1-project-scaffolding--environment-setup)
4. [Phase 2: Core Infrastructure — Redis, Embeddings, Weave](#phase-2-core-infrastructure--redis-embeddings-weave)
5. [Phase 3: Core Engine — The Learning Scraper](#phase-3-core-engine--the-learning-scraper)
6. [Phase 4: API Routes & Task Management](#phase-4-api-routes--task-management)
7. [Phase 5: Dashboard UI](#phase-5-dashboard-ui)
8. [Phase 6: Demo Preparation & Deployment](#phase-6-demo-preparation--deployment)
9. [Architecture Decisions](#architecture-decisions)
10. [Risk Mitigation](#risk-mitigation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      WebScout Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                           │
│  │  Vercel Dashboard │ ◄──── View learning + trigger tasks      │
│  │  (Next.js App)    │                                          │
│  └────────┬─────────┘                                           │
│           │  POST /api/tasks { url, target }                    │
│           ▼                                                     │
│  ┌──────────────────┐     ┌─────────────────────┐              │
│  │   Redis Lookup    │────►│ Similar past task?   │              │
│  │  (Vector Search)  │     │ → Use learned plan   │              │
│  └────────┬─────────┘     └─────────────────────┘              │
│           │ no match found                                      │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────┐              │
│  │          Stagehand / Browserbase              │              │
│  │  1. Navigate to URL                           │              │
│  │  2. Try extraction (may fail)                 │              │
│  │  3. On failure → Recovery Agent               │              │
│  │  4. Learn & store working pattern             │              │
│  └────────┬──────┬──────┬──────┬───────────────┘              │
│           │      │      │      │                               │
│           ▼      ▼      ▼      ▼                               │
│  ┌──────────────────────────────────────────────┐              │
│  │              Weave Tracer                     │              │
│  │  - Screenshot each step                       │              │
│  │  - DOM state before/after                     │              │
│  │  - Success/failure per action                 │              │
│  │  - Nested op tracing                          │              │
│  └──────────────────────────────────────────────┘              │
│                     │                                           │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │     Store learned pattern in Redis            │              │
│  │     (URL pattern + selector + approach)       │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Sponsor Integration

| Sponsor | Role | Integration Depth |
|---------|------|-------------------|
| **Browserbase + Stagehand** | Execute web automation tasks | Core |
| **Weave (W&B)** | Trace every action, log failures | Core |
| **Redis** | Store page patterns → successful actions (vector search) | Core |
| **Vercel** | Dashboard to view learning + trigger tasks | Supporting |

---

## Directory Structure

```
webscout/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (dark theme, fonts)
│   │   ├── page.tsx                    # Redirect to /dashboard
│   │   ├── globals.css                 # Tailwind globals
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Stats + recent tasks + quick form
│   │   │   └── layout.tsx              # Sidebar navigation
│   │   ├── tasks/
│   │   │   ├── page.tsx                # All tasks list
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Task detail + trace timeline
│   │   ├── patterns/
│   │   │   └── page.tsx                # "Failure Recovery Library"
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts            # POST create task, GET list tasks
│   │       │   └── [id]/
│   │       │       └── route.ts        # GET single task detail
│   │       ├── patterns/
│   │       │   └── route.ts            # GET learned patterns
│   │       └── health/
│   │           └── route.ts            # Service health check
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── scraper.ts              # Core learning scrape loop (HEART)
│   │   │   ├── recovery.ts             # Multi-strategy failure recovery
│   │   │   └── pattern-extractor.ts    # Extract reusable patterns
│   │   ├── browser/
│   │   │   ├── session.ts              # Browserbase session management
│   │   │   └── stagehand-client.ts     # Stagehand factory
│   │   ├── redis/
│   │   │   ├── client.ts               # Redis connection singleton
│   │   │   ├── vectors.ts              # Vector index + KNN search + store
│   │   │   └── patterns.ts             # Pattern CRUD helpers
│   │   ├── embeddings/
│   │   │   └── openai.ts               # OpenAI embedding generation
│   │   ├── tracing/
│   │   │   ├── weave.ts                # Weave init + op wrappers
│   │   │   └── trace-context.ts        # Screenshot + DOM capture utils
│   │   └── utils/
│   │       ├── url.ts                  # URL normalization + patterns
│   │       └── types.ts                # Shared TypeScript interfaces
│   ├── components/
│   │   ├── ui/                         # shadcn/ui primitives
│   │   ├── task-form.tsx               # Submit task form
│   │   ├── task-list.tsx               # Task list with status badges
│   │   ├── trace-timeline.tsx          # Visual step-by-step timeline
│   │   ├── pattern-card.tsx            # Single learned pattern card
│   │   ├── pattern-grid.tsx            # Grid of pattern cards
│   │   └── stats-overview.tsx          # Dashboard metric cards
│   └── hooks/
│       ├── use-tasks.ts                # SWR hook for tasks
│       └── use-patterns.ts             # SWR hook for patterns
├── docker-compose.yml                  # Redis Stack local dev
├── .env.example                        # Documented env vars
├── .env.local                          # Actual secrets (gitignored)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Phase 1: Project Scaffolding & Environment Setup

### Goal
Get a running Next.js app with all dependencies installed, env vars configured, and Redis reachable.

---

### Step 1.1: Initialize Next.js Project

```bash
npx create-next-app@latest webscout \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm
```

Select these options if prompted:
- TypeScript: **Yes**
- Tailwind CSS: **Yes**
- ESLint: **Yes**
- `src/` directory: **Yes**
- App Router: **Yes**

---

### Step 1.2: Install All Dependencies

```bash
cd webscout

# Core dependencies
npm install @browserbasehq/stagehand @browserbasehq/sdk zod
npm install weave openai
npm install redis
npm install swr
npm install lucide-react clsx tailwind-merge

# Dev dependencies
npm install -D @types/node
```

**Package Reference:**

| Package | Purpose |
|---------|---------|
| `@browserbasehq/stagehand` | AI-powered browser automation (act, extract, agent) |
| `@browserbasehq/sdk` | Browserbase session management |
| `weave` | W&B Weave tracing and observability |
| `openai` | Embedding generation (`text-embedding-3-small`) |
| `redis` | Redis client with RediSearch vector support |
| `zod` | Schema validation for Stagehand extract |
| `swr` | Client-side data fetching with auto-refresh |
| `lucide-react` | Icon library for dashboard UI |
| `clsx` + `tailwind-merge` | Utility for conditional Tailwind classes |

---

### Step 1.3: Set Up shadcn/ui

```bash
npx shadcn@latest init
```

Choose defaults (New York style, Zinc color, CSS variables: yes).

Then add the UI components we need:

```bash
npx shadcn@latest add button card badge input textarea table tabs separator skeleton
```

---

### Step 1.4: Create `.env.example`

**File: `.env.example`**

```env
# ============================================
# WebScout Environment Variables
# ============================================

# --- Browserbase (cloud browser automation) ---
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id

# --- OpenAI (embeddings + Stagehand LLM backbone) ---
OPENAI_API_KEY=your_openai_api_key

# --- Redis (pattern storage + vector search) ---
# Local: redis://localhost:6379
# Cloud: redis://default:password@host:port
REDIS_URL=redis://localhost:6379

# --- Weave / Weights & Biases (tracing) ---
WANDB_API_KEY=your_wandb_api_key
WEAVE_PROJECT=webscout

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in real values:
```bash
cp .env.example .env.local
```

---

### Step 1.5: Create `docker-compose.yml`

**File: `docker-compose.yml`**

```yaml
version: "3.8"

services:
  redis:
    image: redis/redis-stack:latest
    container_name: webscout-redis
    ports:
      - "6379:6379"   # Redis
      - "8001:8001"   # RedisInsight UI
    volumes:
      - redis-data:/data
    environment:
      - REDIS_ARGS=--requirepass ""

volumes:
  redis-data:
```

Start Redis locally:
```bash
docker compose up -d
```

> **Note:** For production/demo, use **Redis Cloud** free tier or **Upstash Redis** instead of Docker. The code connects via `REDIS_URL`, making it environment-agnostic.

---

### Step 1.6: Create Health Check Route

**File: `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "redis";

export async function GET() {
  const status: Record<string, string> = {
    app: "ok",
    redis: "unknown",
    browserbase: "unknown",
    openai: "unknown",
    weave: "unknown",
  };

  // Check Redis
  try {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    await client.ping();
    await client.disconnect();
    status.redis = "ok";
  } catch (e) {
    status.redis = `error: ${(e as Error).message}`;
  }

  // Check API keys exist
  status.browserbase = process.env.BROWSERBASE_API_KEY ? "configured" : "missing";
  status.openai = process.env.OPENAI_API_KEY ? "configured" : "missing";
  status.weave = process.env.WANDB_API_KEY ? "configured" : "missing";

  const allOk = Object.values(status).every(
    (s) => s === "ok" || s === "configured"
  );

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", services: status },
    { status: allOk ? 200 : 503 }
  );
}
```

---

### Step 1.7: Verify Phase 1

```bash
# Start the dev server
npm run dev
# → Should serve on http://localhost:3000

# Start Redis
docker compose up -d

# Test health endpoint
curl http://localhost:3000/api/health
# → Should return { status: "healthy", services: { ... } }
```

**Checklist:**
- [ ] `npm run dev` starts without errors
- [ ] Default Next.js page renders at `localhost:3000`
- [ ] Redis is reachable (`/api/health` shows redis: "ok")
- [ ] All env vars set in `.env.local`
- [ ] shadcn/ui components installed

---

## Phase 2: Core Infrastructure — Redis, Embeddings, Weave

### Goal
Build the foundational services: Redis vector index, embedding generation, Weave tracing wrappers, shared types. These are prerequisites for the learning engine.

---

### Step 2.1: Shared TypeScript Types

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
  score?: number; // similarity score from vector search
}

export interface TaskRequest {
  url: string;
  target: string; // what to extract, e.g. "product price"
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
  screenshots: string[]; // base64 screenshots at each step
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
```

---

### Step 2.2: URL Normalization Utilities

**File: `src/lib/utils/url.ts`**

```typescript
// ============================================
// URL Pattern Extraction
// ============================================
// Converts specific URLs into reusable patterns
// e.g., "https://www.amazon.com/dp/B09V3KXJPB?ref=foo"
//     → "amazon.com/dp/*"

export function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove www. prefix
    let hostname = parsed.hostname.replace(/^www\./, "");

    // Get path segments and replace dynamic parts with *
    let pathSegments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        // Replace segments that look like IDs (long alphanumeric, UUIDs, numbers)
        if (/^[a-f0-9-]{8,}$/i.test(segment)) return "*";
        if (/^\d{4,}$/.test(segment)) return "*";
        if (/^B[A-Z0-9]{9}$/.test(segment)) return "*"; // Amazon ASINs
        return segment;
      });

    return `${hostname}/${pathSegments.join("/")}`;
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Strip tracking params
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "ref_", "tag", "source", "fbclid", "gclid",
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}
```

---

### Step 2.3: Redis Client Singleton

**File: `src/lib/redis/client.ts`**

```typescript
import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectionPromise: Promise<RedisClient> | null = null;

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

### Step 2.4: OpenAI Embedding Service

**File: `src/lib/embeddings/openai.ts`**

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a 1536-dimensional embedding vector for the given text.
 * Uses OpenAI's text-embedding-3-small model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim().substring(0, 8000), // max token safety
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.trim().substring(0, 8000)),
  });

  return response.data.map((d) => d.embedding);
}
```

---

### Step 2.5: Redis Vector Index and Search Operations

**File: `src/lib/redis/vectors.ts`**

This is one of the most critical files — it powers the "learning" capability.

```typescript
import { SchemaFieldTypes, VectorAlgorithms } from "redis";
import { getRedisClient } from "./client";
import { generateEmbedding } from "../embeddings/openai";
import type { PatternData, PagePattern } from "../utils/types";

const INDEX_NAME = "idx:page_patterns";
const PREFIX = "pattern:";
const VECTOR_DIM = 1536; // text-embedding-3-small dimensions

// ============================================
// Index Management
// ============================================

/**
 * Create the RediSearch vector index if it doesn't exist.
 * Call this on app startup.
 */
export async function ensureVectorIndex(): Promise<void> {
  const client = await getRedisClient();

  try {
    await client.ft.info(INDEX_NAME);
    console.log("[Redis] Vector index already exists");
  } catch {
    // Index doesn't exist, create it
    console.log("[Redis] Creating vector index...");

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
      {
        ON: "HASH",
        PREFIX: PREFIX,
      }
    );

    console.log("[Redis] Vector index created successfully");
  }
}

// ============================================
// Vector Search (Finding Similar Patterns)
// ============================================

/**
 * Search for patterns similar to the query text using KNN vector search.
 * Returns top-k matches sorted by cosine similarity.
 *
 * @param queryText - Combined URL pattern + target string
 * @param topK - Number of results to return (default 3)
 * @returns Array of matching patterns with similarity scores
 */
export async function searchSimilarPatterns(
  queryText: string,
  topK: number = 3
): Promise<PagePattern[]> {
  const client = await getRedisClient();
  const embedding = await generateEmbedding(queryText);

  // Convert embedding to Buffer for Redis
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  try {
    const results = await client.ft.search(
      INDEX_NAME,
      `*=>[KNN ${topK} @embedding $BLOB AS vector_score]`,
      {
        PARAMS: { BLOB: embeddingBuffer },
        SORTBY: { BY: "vector_score", DIRECTION: "ASC" }, // lower = more similar for COSINE
        DIALECT: 2,
        RETURN: [
          "url_pattern",
          "target",
          "working_selector",
          "approach",
          "vector_score",
          "success_count",
          "created_at",
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
      // COSINE distance: 0 = identical, 2 = opposite
      // Convert to similarity: 1 - (distance / 2)
      score: 1 - parseFloat(doc.value.vector_score as string) / 2,
    }));
  } catch (error) {
    console.error("[Redis] Vector search failed:", error);
    return [];
  }
}

// ============================================
// Store Pattern (Learning from success/recovery)
// ============================================

/**
 * Store a learned pattern with its embedding vector in Redis.
 * This is called after a successful extraction or recovery.
 *
 * @param data - The pattern data to store
 * @returns The Redis key of the stored pattern
 */
export async function storePattern(data: PatternData): Promise<string> {
  const client = await getRedisClient();

  // Generate embedding for the pattern
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

  console.log(`[Redis] Stored pattern: ${id} for ${data.url_pattern}`);
  return id;
}

// ============================================
// Increment Success Count
// ============================================

/**
 * Increment the success_count for a pattern (called when a cached pattern is reused).
 */
export async function incrementPatternSuccess(patternId: string): Promise<void> {
  const client = await getRedisClient();
  await client.hIncrBy(patternId, "success_count", 1);
}
```

---

### Step 2.6: Pattern CRUD Helpers

**File: `src/lib/redis/patterns.ts`**

```typescript
import { getRedisClient } from "./client";
import type { PagePattern } from "../utils/types";

const PREFIX = "pattern:";

/**
 * List all learned patterns, sorted by success_count descending.
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
        "url_pattern",
        "target",
        "working_selector",
        "approach",
        "success_count",
        "created_at",
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

/**
 * Get a single pattern by its Redis key.
 */
export async function getPattern(
  patternId: string
): Promise<PagePattern | null> {
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

/**
 * Delete a pattern by its Redis key.
 */
export async function deletePattern(patternId: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(patternId);
}

/**
 * Get total count of all stored patterns.
 */
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

### Step 2.7: Weave Tracing Setup

**File: `src/lib/tracing/weave.ts`**

```typescript
import * as weave from "weave";

let initialized = false;

/**
 * Initialize Weave tracing. Call once on app startup.
 * Idempotent — safe to call multiple times.
 */
export async function initWeave(): Promise<void> {
  if (initialized) return;

  try {
    await weave.init(process.env.WEAVE_PROJECT || "webscout");
    initialized = true;
    console.log("[Weave] Initialized successfully");
  } catch (error) {
    console.warn("[Weave] Failed to initialize:", (error as Error).message);
    // Don't throw — app should work without Weave
  }
}

/**
 * Create a traced operation using weave.op.
 * Wraps any async function with Weave tracing.
 *
 * Usage:
 *   const tracedFn = createTracedOp("myFunction", async (arg) => { ... });
 *   const result = await tracedFn(arg);
 */
export function createTracedOp<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  try {
    return weave.op(fn, { name }) as T;
  } catch {
    // Fallback: return untraced function if Weave isn't initialized
    return fn;
  }
}

// Re-export weave for direct use
export { weave };
```

---

### Step 2.8: Trace Context Utilities

**File: `src/lib/tracing/trace-context.ts`**

```typescript
import type { Page } from "playwright";

/**
 * Capture a screenshot from the current browser page.
 * Returns a base64-encoded PNG string.
 */
export async function captureScreenshot(page: Page): Promise<string> {
  try {
    const buffer = await page.screenshot({
      type: "png",
      fullPage: false, // viewport only for speed
    });
    return buffer.toString("base64");
  } catch (error) {
    console.warn("[Trace] Screenshot capture failed:", (error as Error).message);
    return "";
  }
}

/**
 * Capture a simplified DOM snapshot of the current page.
 * Returns a truncated HTML string for logging.
 */
export async function captureDOMSnapshot(page: Page): Promise<string> {
  try {
    const html = await page.evaluate(() => {
      // Get a simplified version of the DOM
      const body = document.body;
      if (!body) return "<empty>";

      // Remove scripts and styles for cleaner output
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

      // Truncate to a reasonable size
      return clone.innerHTML.substring(0, 5000);
    });
    return html;
  } catch (error) {
    console.warn("[Trace] DOM snapshot failed:", (error as Error).message);
    return "<unavailable>";
  }
}

/**
 * Build metadata object for a trace step.
 */
export function buildStepMetadata(
  url: string,
  target: string,
  attempt: number,
  extras?: Record<string, any>
) {
  return {
    url,
    target,
    attempt,
    timestamp: Date.now(),
    ...extras,
  };
}
```

---

### Step 2.9: Verify Phase 2

Create a temporary test script or use the health route to verify:

```bash
# Test Redis vector index creation
curl http://localhost:3000/api/health

# The ensureVectorIndex() should be called on first request
# Check RedisInsight at http://localhost:8001 to see the index
```

**Checklist:**
- [ ] Redis client connects and pings successfully
- [ ] `generateEmbedding("test text")` returns a 1536-dimension array
- [ ] `ensureVectorIndex()` creates the index (check via RedisInsight or `FT.INFO`)
- [ ] Can `storePattern()` and then `searchSimilarPatterns()` finds it
- [ ] `incrementPatternSuccess()` increments the counter
- [ ] Weave initializes (check W&B dashboard for the project)
- [ ] All types compile without errors

---

## Phase 3: Core Engine — The Learning Scraper

### Goal
Build the core scraping engine: Browserbase sessions, Stagehand automation, the learning loop (cache → extract → fail → recover → store), and multi-strategy recovery.

---

### Step 3.1: Browserbase Session Management

**File: `src/lib/browser/session.ts`**

```typescript
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

/**
 * Create a new Browserbase cloud browser session.
 * Returns the session object with ID and connect URL.
 */
export async function createBrowserSession() {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  console.log(`[Browserbase] Session created: ${session.id}`);
  return session;
}

/**
 * Get the live view URL for a session (useful for debugging).
 */
export function getSessionDebugUrl(sessionId: string): string {
  return `https://www.browserbase.com/sessions/${sessionId}`;
}
```

---

### Step 3.2: Stagehand Client Factory

**File: `src/lib/browser/stagehand-client.ts`**

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

/**
 * Create and initialize a Stagehand instance backed by Browserbase.
 *
 * Stagehand provides AI-powered browser automation:
 * - stagehand.page.goto(url) — navigate
 * - stagehand.extract(instruction, schema) — extract structured data
 * - stagehand.act(action) — perform actions (click, type, etc.)
 * - stagehand.agent(task) — autonomous multi-step agent
 */
export async function createStagehand(): Promise<Stagehand> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    modelName: "gpt-4o",          // LLM for AI actions
    modelClientOptions: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
  });

  await stagehand.init();
  console.log("[Stagehand] Initialized with Browserbase");

  return stagehand;
}

/**
 * Safely close a Stagehand instance.
 */
export async function closeStagehand(stagehand: Stagehand): Promise<void> {
  try {
    await stagehand.close();
    console.log("[Stagehand] Session closed");
  } catch (error) {
    console.warn("[Stagehand] Error closing session:", (error as Error).message);
  }
}
```

---

### Step 3.3: Pattern Extractor

**File: `src/lib/engine/pattern-extractor.ts`**

```typescript
import type { PatternData } from "../utils/types";
import { extractUrlPattern } from "../utils/url";

/**
 * After a successful extraction or recovery, build a reusable PatternData
 * object that can be stored in Redis for future use.
 */
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

/**
 * Determine if a search result is confident enough to use.
 * Threshold is 0.85 (85% similarity).
 */
export function isConfidentMatch(score: number): boolean {
  return score >= 0.85;
}

/**
 * Build a refined extraction instruction from a failed attempt.
 * Adds more specificity to help Stagehand find the target.
 */
export function buildRefinedInstruction(
  originalTarget: string,
  failureContext: string
): string {
  return (
    `The previous attempt to extract "${originalTarget}" failed. ` +
    `Context: ${failureContext}. ` +
    `Please look more carefully at the page structure. ` +
    `Try alternative locations: main content area, sidebar, headers, ` +
    `product details section, pricing section, or data tables. ` +
    `Extract: ${originalTarget}`
  );
}
```

---

### Step 3.4: Recovery Strategies

**File: `src/lib/engine/recovery.ts`**

```typescript
import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";
import type { RecoveryResult, TaskRequest } from "../utils/types";
import { captureScreenshot } from "../tracing/trace-context";
import { createTracedOp } from "../tracing/weave";
import { z } from "zod";

/**
 * Attempt to recover from a failed extraction using multiple strategies.
 * Tries each strategy in order and returns the first successful result.
 *
 * Strategy order:
 * 1. Agent-based: Let Stagehand's autonomous agent find the data
 * 2. Act-based: Remove blockers (cookie banners, modals), then re-extract
 * 3. Refined extract: Use a more detailed instruction
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

    // ── Strategy A: Agent-based autonomous recovery ──
    try {
      console.log("[Recovery] Trying Strategy A: Agent-based");
      const agentResult = await strategyAgent(stagehand, task);
      if (agentResult) return agentResult;
    } catch (error) {
      console.warn("[Recovery] Strategy A failed:", (error as Error).message);
    }

    // ── Strategy B: Act-based — remove blockers then re-extract ──
    try {
      console.log("[Recovery] Trying Strategy B: Remove blockers");
      const actResult = await strategyRemoveBlockers(stagehand, page, task);
      if (actResult) return actResult;
    } catch (error) {
      console.warn("[Recovery] Strategy B failed:", (error as Error).message);
    }

    // ── Strategy C: Refined extraction instruction ──
    try {
      console.log("[Recovery] Trying Strategy C: Refined instruction");
      const refinedResult = await strategyRefinedExtract(
        stagehand,
        task,
        failureContext
      );
      if (refinedResult) return refinedResult;
    } catch (error) {
      console.warn("[Recovery] Strategy C failed:", (error as Error).message);
    }

    console.log("[Recovery] All strategies exhausted");
    return null;
  }
);

// ── Strategy A: Agent ──────────────────────────────────

async function strategyAgent(
  stagehand: Stagehand,
  task: TaskRequest
): Promise<RecoveryResult | null> {
  const agent = stagehand.agent({
    modelName: "gpt-4o",
    modelClientOptions: { apiKey: process.env.OPENAI_API_KEY! },
  });

  const agentResult = await agent.execute(
    `You are on the page ${task.url}. ` +
    `Your goal is to find and extract: "${task.target}". ` +
    `The page may have cookie banners, popups, or other overlays — dismiss them if needed. ` +
    `Look through the entire page content to find the requested data. ` +
    `When you find it, report the data clearly.`
  );

  if (agentResult) {
    return {
      success: true,
      result: agentResult,
      strategy_used: "agent",
      working_selector: `agent: find ${task.target}`,
    };
  }

  return null;
}

// ── Strategy B: Remove Blockers ────────────────────────

async function strategyRemoveBlockers(
  stagehand: Stagehand,
  page: Page,
  task: TaskRequest
): Promise<RecoveryResult | null> {
  // Try to dismiss common blockers
  const blockerActions = [
    "Click any cookie consent accept/agree button if visible",
    "Close any popup or modal dialog if visible",
    "Dismiss any overlay or notification banner if visible",
    "Scroll down to see more content",
  ];

  for (const action of blockerActions) {
    try {
      await stagehand.act({ action });
      // Brief wait for page to settle
      await page.waitForTimeout(500);
    } catch {
      // Blocker not found — that's fine, move on
    }
  }

  // Now retry extraction
  try {
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
  } catch {
    // Re-extraction still failed
  }

  return null;
}

// ── Strategy C: Refined Extraction ─────────────────────

async function strategyRefinedExtract(
  stagehand: Stagehand,
  task: TaskRequest,
  failureContext: string
): Promise<RecoveryResult | null> {
  const refinedInstruction =
    `Previous extraction failed (${failureContext}). ` +
    `Look more carefully for "${task.target}" on this page. ` +
    `Check: main content, sidebars, tables, headers, product details, ` +
    `pricing sections, metadata, and any dynamically loaded content. ` +
    `Be thorough and try different interpretations of what "${task.target}" means.`;

  try {
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
  } catch {
    // Refined extraction also failed
  }

  return null;
}
```

---

### Step 3.5: Core Learning Scraper (The Heart of WebScout)

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

// ============================================
// Core Learning Scrape Engine
// ============================================
//
// Algorithm:
// 1. Check Redis for similar past patterns (vector KNN search)
// 2. Launch cloud browser via Browserbase/Stagehand
// 3. If cached pattern found → try it first
// 4. If no cache / cache failed → fresh extraction attempt
// 5. If fresh attempt failed → RECOVERY (the learning step)
//    - Multi-strategy recovery (agent, act, refined extract)
//    - On success: store working pattern in Redis
// 6. Every step: traced via Weave, screenshots captured
// ============================================

export const learningScrape = createTracedOp(
  "learningScrape",
  async function learningScrape(task: TaskRequest): Promise<TaskResult> {
    // Initialize services
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

    // ── Step 1: Search Redis for known patterns ──

    steps.push({
      action: "vector_search",
      status: "info",
      detail: `Searching Redis for patterns matching: "${urlPattern} ${task.target}"`,
      timestamp: Date.now(),
    });

    const queryText = `${urlPattern} ${task.target}`;
    const cachedPatterns = await searchSimilarPatterns(queryText, 3);

    const bestMatch =
      cachedPatterns.length > 0 && cachedPatterns[0].score !== undefined
        ? cachedPatterns[0]
        : null;

    if (bestMatch && isConfidentMatch(bestMatch.score!)) {
      steps.push({
        action: "cache_hit",
        status: "success",
        detail: `Found cached pattern (${(bestMatch.score! * 100).toFixed(1)}% match): "${bestMatch.working_selector}"`,
        timestamp: Date.now(),
      });
    } else {
      steps.push({
        action: "cache_miss",
        status: "info",
        detail:
          cachedPatterns.length > 0
            ? `Best match only ${((cachedPatterns[0]?.score || 0) * 100).toFixed(1)}% similar — below 85% threshold`
            : "No patterns found in Redis",
        timestamp: Date.now(),
      });
    }

    // ── Step 2: Launch browser ──

    steps.push({
      action: "browser_init",
      status: "info",
      detail: "Launching cloud browser via Browserbase + Stagehand",
      timestamp: Date.now(),
    });

    const stagehand = await createStagehand();
    const page = stagehand.context.pages()[0];

    try {
      // Navigate to URL
      await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000); // let page settle

      const initialScreenshot = await captureScreenshot(page);
      screenshots.push(initialScreenshot);

      steps.push({
        action: "navigate",
        status: "success",
        detail: `Navigated to ${task.url}`,
        screenshot: initialScreenshot,
        timestamp: Date.now(),
      });

      // ── Step 3: Try cached pattern (if confident match) ──

      if (bestMatch && isConfidentMatch(bestMatch.score!)) {
        try {
          steps.push({
            action: "cached_extract",
            status: "info",
            detail: `Trying cached pattern: "${bestMatch.working_selector}"`,
            timestamp: Date.now(),
          });

          const result = await stagehand.extract({
            instruction: bestMatch.working_selector,
            schema: z.object({ data: z.any() }),
          });

          if (result && result.data) {
            usedCachedPattern = true;
            await incrementPatternSuccess(bestMatch.id);

            const successScreenshot = await captureScreenshot(page);
            screenshots.push(successScreenshot);

            steps.push({
              action: "cached_extract",
              status: "success",
              detail: `Cached pattern worked! Extracted data successfully. Pattern reuse count incremented.`,
              screenshot: successScreenshot,
              timestamp: Date.now(),
            });

            return buildTaskResult(
              taskId, task, "success", result.data,
              steps, screenshots, usedCachedPattern, recoveryAttempted,
              bestMatch.id, startTime
            );
          }
        } catch (error) {
          steps.push({
            action: "cached_extract",
            status: "failure",
            detail: `Cached pattern failed: ${(error as Error).message}. Falling back to fresh attempt.`,
            timestamp: Date.now(),
          });
        }
      }

      // ── Step 4: Fresh extraction attempt ──

      try {
        steps.push({
          action: "fresh_extract",
          status: "info",
          detail: `Attempting fresh extraction: "${task.target}"`,
          timestamp: Date.now(),
        });

        const result = await stagehand.extract({
          instruction: task.target,
          schema: z.object({ data: z.any() }),
        });

        if (result && result.data) {
          // Store the successful pattern for future use
          const pattern = buildPattern(task.url, task.target, task.target, "extract");
          patternId = await storePattern(pattern);

          const successScreenshot = await captureScreenshot(page);
          screenshots.push(successScreenshot);

          steps.push({
            action: "fresh_extract",
            status: "success",
            detail: "Fresh extraction succeeded! Pattern stored in Redis for future use.",
            screenshot: successScreenshot,
            timestamp: Date.now(),
          });

          steps.push({
            action: "pattern_stored",
            status: "success",
            detail: `New pattern stored: ${patternId}`,
            timestamp: Date.now(),
          });

          return buildTaskResult(
            taskId, task, "success", result.data,
            steps, screenshots, usedCachedPattern, recoveryAttempted,
            patternId, startTime
          );
        }
      } catch (error) {
        const failScreenshot = await captureScreenshot(page);
        screenshots.push(failScreenshot);

        steps.push({
          action: "fresh_extract",
          status: "failure",
          detail: `Fresh extraction failed: ${(error as Error).message}`,
          screenshot: failScreenshot,
          timestamp: Date.now(),
        });
      }

      // ── Step 5: RECOVERY — the learning step ──

      recoveryAttempted = true;

      steps.push({
        action: "recovery_start",
        status: "recovery",
        detail: "Starting multi-strategy recovery: analyzing page for alternative approaches...",
        timestamp: Date.now(),
      });

      const domSnapshot = await captureDOMSnapshot(page);

      const recoveryResult = await attemptRecovery(
        stagehand,
        page,
        task,
        `Extraction of "${task.target}" failed on ${urlPattern}`
      );

      if (recoveryResult && recoveryResult.success) {
        // LEARNED SOMETHING NEW! Store the pattern.
        const pattern = buildPattern(
          task.url,
          task.target,
          recoveryResult.working_selector,
          recoveryResult.strategy_used === "extract_refined" ? "extract" : recoveryResult.strategy_used as "act" | "agent"
        );
        patternId = await storePattern(pattern);

        const recoveryScreenshot =
          recoveryResult.screenshot || (await captureScreenshot(page));
        screenshots.push(recoveryScreenshot);

        steps.push({
          action: "recovery_success",
          status: "success",
          detail: `Recovery succeeded via strategy: "${recoveryResult.strategy_used}". Pattern learned and stored!`,
          screenshot: recoveryScreenshot,
          timestamp: Date.now(),
        });

        steps.push({
          action: "pattern_learned",
          status: "success",
          detail: `Learned new pattern: ${patternId} (${recoveryResult.strategy_used})`,
          timestamp: Date.now(),
        });

        return buildTaskResult(
          taskId, task, "success", recoveryResult.result,
          steps, screenshots, usedCachedPattern, recoveryAttempted,
          patternId, startTime
        );
      }

      // ── All strategies failed ──

      steps.push({
        action: "recovery_failed",
        status: "failure",
        detail: "All recovery strategies exhausted. Task failed.",
        dom_snapshot: domSnapshot,
        timestamp: Date.now(),
      });

      return buildTaskResult(
        taskId, task, "failed", null,
        steps, screenshots, usedCachedPattern, recoveryAttempted,
        undefined, startTime
      );
    } finally {
      // Always clean up the browser session
      await closeStagehand(stagehand);
    }
  }
);

// ============================================
// Helper: Build TaskResult object
// ============================================

function buildTaskResult(
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

### Step 3.6: Verify Phase 3

```bash
# Test with a reliable public site
# Use the API (built in Phase 4) or create a temporary test script:

# Example test (will be available after Phase 4):
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", "target": "book price"}'
```

**Checklist:**
- [ ] `createStagehand()` initializes and connects to Browserbase
- [ ] Can navigate to a URL and take a screenshot
- [ ] `learningScrape` completes full cycle against `books.toscrape.com`
- [ ] Pattern is stored in Redis after first run
- [ ] Second run with similar URL hits the cache
- [ ] Recovery strategies execute when primary extraction fails
- [ ] Weave shows full nested trace tree in W&B dashboard
- [ ] Screenshots captured at each step

---

## Phase 4: API Routes & Task Management

### Goal
Expose the engine via Next.js API routes. Add Redis-backed task storage so the dashboard can submit, list, and inspect tasks.

---

### Step 4.1: Task Storage Helpers

Add task storage functions alongside patterns. Tasks are stored as Redis hashes with key `task:{uuid}`.

**Add to `src/lib/redis/patterns.ts` (or create `src/lib/redis/tasks.ts`):**

```typescript
// ============================================
// Task Storage (Redis Hashes)
// ============================================

import { getRedisClient } from "./client";
import type { TaskResult } from "../utils/types";

const TASK_PREFIX = "task:";

/**
 * Store a task result in Redis.
 */
export async function storeTask(task: TaskResult): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${task.id}`;

  await client.hSet(key, {
    data: JSON.stringify(task),
    created_at: task.created_at.toString(),
    status: task.status,
  });

  // Add to sorted set for ordered listing
  await client.zAdd("tasks:timeline", {
    score: task.created_at,
    value: task.id,
  });
}

/**
 * Get a task by ID.
 */
export async function getTask(taskId: string): Promise<TaskResult | null> {
  const client = await getRedisClient();
  const data = await client.hGet(`${TASK_PREFIX}${taskId}`, "data");
  if (!data) return null;
  return JSON.parse(data) as TaskResult;
}

/**
 * List recent tasks, newest first.
 */
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

/**
 * Get aggregate stats for all tasks.
 */
export async function getTaskStats(): Promise<{
  total: number;
  successful: number;
  failed: number;
  cached: number;
  recovered: number;
}> {
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

### Step 4.2: Tasks API Route

**File: `src/app/api/tasks/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { learningScrape } from "@/lib/engine/scraper";
import { storeTask, listTasks, getTaskStats } from "@/lib/redis/tasks";
import { getPatternCount } from "@/lib/redis/patterns";
import type { TaskRequest } from "@/lib/utils/types";

// Allow longer execution for scraping tasks
export const maxDuration = 60; // seconds (Vercel Pro)

/**
 * POST /api/tasks — Submit a new scraping task
 *
 * Body: { url: string, target: string }
 * Response: TaskResult
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, target } = body as TaskRequest;

    // Validate input
    if (!url || !target) {
      return NextResponse.json(
        { error: "Both 'url' and 'target' are required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    console.log(`[API] New task: extract "${target}" from ${url}`);

    // Execute the learning scrape
    const result = await learningScrape({ url, target });

    // Store result in Redis
    await storeTask(result);

    console.log(`[API] Task ${result.id} completed: ${result.status}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Task execution error:", error);
    return NextResponse.json(
      { error: "Task execution failed", detail: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks — List recent tasks + stats
 *
 * Query: ?limit=20&offset=0
 * Response: { tasks: TaskResult[], total: number, stats: {...} }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { tasks, total } = await listTasks(limit, offset);
    const stats = await getTaskStats();
    const patternCount = await getPatternCount();

    return NextResponse.json({
      tasks,
      total,
      stats: {
        ...stats,
        patterns_learned: patternCount,
        cache_hit_rate:
          stats.total > 0
            ? ((stats.cached / stats.total) * 100).toFixed(1) + "%"
            : "0%",
        recovery_rate:
          stats.recovered + stats.failed > 0
            ? (
                (stats.recovered / (stats.recovered + stats.failed)) *
                100
              ).toFixed(1) + "%"
            : "N/A",
      },
    });
  } catch (error) {
    console.error("[API] List tasks error:", error);
    return NextResponse.json(
      { error: "Failed to list tasks" },
      { status: 500 }
    );
  }
}
```

---

### Step 4.3: Task Detail API Route

**File: `src/app/api/tasks/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/redis/tasks";

/**
 * GET /api/tasks/:id — Get a single task with all details
 *
 * Returns: TaskResult (including steps, screenshots, trace data)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getTask(id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("[API] Get task error:", error);
    return NextResponse.json(
      { error: "Failed to get task" },
      { status: 500 }
    );
  }
}
```

---

### Step 4.4: Patterns API Route

**File: `src/app/api/patterns/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listPatterns, getPatternCount } from "@/lib/redis/patterns";

/**
 * GET /api/patterns — List all learned patterns
 *
 * Query: ?limit=50&offset=0
 * Response: { patterns: PagePattern[], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { patterns, total } = await listPatterns(limit, offset);

    return NextResponse.json({ patterns, total });
  } catch (error) {
    console.error("[API] List patterns error:", error);
    return NextResponse.json(
      { error: "Failed to list patterns" },
      { status: 500 }
    );
  }
}
```

---

### Step 4.5: Verify Phase 4

```bash
# Start dev server
npm run dev

# Submit a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": "book title and price"
  }'

# List tasks
curl http://localhost:3000/api/tasks

# Get task detail (use the id from the POST response)
curl http://localhost:3000/api/tasks/<task-id>

# List learned patterns
curl http://localhost:3000/api/patterns

# Submit the SAME task again — should use cached pattern
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": "book title and price"
  }'
# → Response should have used_cached_pattern: true
```

**Checklist:**
- [ ] POST creates task, runs scrape, returns result
- [ ] GET lists tasks with stats
- [ ] GET by ID returns full task detail with steps and screenshots
- [ ] GET patterns returns learned patterns
- [ ] Second identical task shows `used_cached_pattern: true`
- [ ] Health endpoint still works

---

## Phase 5: Dashboard UI

### Goal
Build the Next.js dashboard for visual impact. Show the learning process, failure recovery library, and real-time task execution.

---

### Step 5.1: Root Layout (Dark Theme)

**File: `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebScout — Browser Agent That Learns From Failures",
  description: "Every failed click makes it smarter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
```

---

### Step 5.2: Root Page (Redirect)

**File: `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

---

### Step 5.3: Dashboard Layout with Sidebar

**File: `src/app/dashboard/layout.tsx`**

```tsx
import Link from "next/link";
import {
  LayoutDashboard,
  ListTodo,
  Brain,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/patterns", label: "Recovery Library", icon: Brain },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            WebScout
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Every failed click makes it smarter
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            Powered by Browserbase, Weave, Redis
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
```

---

### Step 5.4: SWR Data Fetching Hooks

**File: `src/hooks/use-tasks.ts`**

```typescript
import useSWR from "swr";
import type { TaskResult } from "@/lib/utils/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTasks() {
  return useSWR<{
    tasks: TaskResult[];
    total: number;
    stats: {
      total: number;
      successful: number;
      failed: number;
      cached: number;
      recovered: number;
      patterns_learned: number;
      cache_hit_rate: string;
      recovery_rate: string;
    };
  }>("/api/tasks", fetcher, { refreshInterval: 5000 });
}

export function useTask(id: string) {
  return useSWR<TaskResult>(`/api/tasks/${id}`, fetcher, {
    refreshInterval: 2000,
  });
}
```

**File: `src/hooks/use-patterns.ts`**

```typescript
import useSWR from "swr";
import type { PagePattern } from "@/lib/utils/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePatterns() {
  return useSWR<{
    patterns: PagePattern[];
    total: number;
  }>("/api/patterns", fetcher, { refreshInterval: 5000 });
}
```

---

### Step 5.5: Stats Overview Component

**File: `src/components/stats-overview.tsx`**

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Brain, CheckCircle, XCircle, Zap, Target, RefreshCw } from "lucide-react";

interface StatsProps {
  stats: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
    recovered: number;
    patterns_learned: number;
    cache_hit_rate: string;
    recovery_rate: string;
  };
}

const statCards = [
  {
    key: "total",
    label: "Total Tasks",
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "patterns_learned",
    label: "Patterns Learned",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    key: "cache_hit_rate",
    label: "Cache Hit Rate",
    icon: Zap,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    key: "recovery_rate",
    label: "Recovery Rate",
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export function StatsOverview({ stats }: StatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card) => {
        const value = stats[card.key as keyof typeof stats];
        return (
          <Card
            key={card.key}
            className="bg-zinc-900 border-zinc-800 p-6"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-zinc-500">{card.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

---

### Step 5.6: Task Submission Form

**File: `src/components/task-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Globe } from "lucide-react";

interface TaskFormProps {
  onTaskComplete?: () => void;
}

export function TaskForm({ onTaskComplete }: TaskFormProps) {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, target }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Task failed");
      }

      // Reset form
      setUrl("");
      setTarget("");
      onTaskComplete?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-emerald-500" />
        New Scraping Task
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 mb-1 block">URL</label>
          <Input
            type="url"
            placeholder="https://example.com/product/123"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400 mb-1 block">
            What to extract
          </label>
          <Textarea
            placeholder='e.g., "product price and title"'
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            disabled={loading}
            rows={2}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running scrape... (this may take a moment)
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Run Task
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
```

---

### Step 5.7: Task List Component

**File: `src/components/task-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskResult } from "@/lib/utils/types";
import { CheckCircle, XCircle, RefreshCw, Zap, Clock } from "lucide-react";

interface TaskListProps {
  tasks: TaskResult[];
}

function getStatusBadge(task: TaskResult) {
  if (task.used_cached_pattern) {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
        <Zap className="w-3 h-3 mr-1" />
        Cached
      </Badge>
    );
  }
  if (task.recovery_attempted && task.status === "success") {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
        <RefreshCw className="w-3 h-3 mr-1" />
        Recovered
      </Badge>
    );
  }
  if (task.status === "success") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <CheckCircle className="w-3 h-3 mr-1" />
        Success
      </Badge>
    );
  }
  if (task.status === "failed") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
      <Clock className="w-3 h-3 mr-1" />
      {task.status}
    </Badge>
  );
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
        <p className="text-zinc-500">No tasks yet. Submit your first task above!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`}>
          <Card className="bg-zinc-900 border-zinc-800 p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {task.target}
                </p>
                <p className="text-xs text-zinc-500 truncate">{task.url}</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {getStatusBadge(task)}
                <span className="text-xs text-zinc-600">
                  {task.steps.length} steps
                </span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

---

### Step 5.8: Trace Timeline Component (Most Demo-Impactful)

**File: `src/components/trace-timeline.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskStep } from "@/lib/utils/types";
import {
  Search, Globe, CheckCircle, XCircle, RefreshCw, Brain,
  Database, Info, Zap,
} from "lucide-react";
import { useState } from "react";

interface TraceTimelineProps {
  steps: TaskStep[];
  screenshots: string[];
}

const actionIcons: Record<string, any> = {
  vector_search: Search,
  cache_hit: Zap,
  cache_miss: Search,
  browser_init: Globe,
  navigate: Globe,
  cached_extract: Zap,
  fresh_extract: Brain,
  recovery_start: RefreshCw,
  recovery_success: CheckCircle,
  recovery_failed: XCircle,
  pattern_stored: Database,
  pattern_learned: Brain,
};

const statusColors: Record<string, string> = {
  success: "border-emerald-500 bg-emerald-500/10",
  failure: "border-red-500 bg-red-500/10",
  recovery: "border-amber-500 bg-amber-500/10",
  info: "border-zinc-600 bg-zinc-800",
};

const statusDotColors: Record<string, string> = {
  success: "bg-emerald-500",
  failure: "bg-red-500",
  recovery: "bg-amber-500",
  info: "bg-zinc-500",
};

export function TraceTimeline({ steps, screenshots }: TraceTimelineProps) {
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const Icon = actionIcons[step.action] || Info;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex gap-4">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${statusDotColors[step.status]} mt-1.5 ring-2 ring-zinc-900`} />
              {!isLast && <div className="w-px flex-1 bg-zinc-800 my-1" />}
            </div>

            {/* Content */}
            <Card className={`flex-1 mb-3 p-4 border ${statusColors[step.status]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {step.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          step.status === "success"
                            ? "text-emerald-400 border-emerald-500/30"
                            : step.status === "failure"
                            ? "text-red-400 border-red-500/30"
                            : step.status === "recovery"
                            ? "text-amber-400 border-amber-500/30"
                            : "text-zinc-400 border-zinc-600"
                        }`}
                      >
                        {step.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400">{step.detail}</p>
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-xs text-zinc-600 shrink-0">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Screenshot thumbnail */}
              {step.screenshot && (
                <div className="mt-3 ml-7">
                  <img
                    src={`data:image/png;base64,${step.screenshot}`}
                    alt={`Screenshot: ${step.action}`}
                    className="rounded border border-zinc-700 max-w-xs cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedScreenshot(step.screenshot!)}
                  />
                </div>
              )}
            </Card>
          </div>
        );
      })}

      {/* Expanded screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={() => setExpandedScreenshot(null)}
        >
          <img
            src={`data:image/png;base64,${expandedScreenshot}`}
            alt="Full screenshot"
            className="max-w-full max-h-full rounded-lg border border-zinc-700"
          />
        </div>
      )}
    </div>
  );
}
```

---

### Step 5.9: Pattern Card Component

**File: `src/components/pattern-card.tsx`**

```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PagePattern } from "@/lib/utils/types";
import { Globe, Target, Code, CheckCircle } from "lucide-react";

interface PatternCardProps {
  pattern: PagePattern;
}

const approachColors: Record<string, string> = {
  extract: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  act: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  agent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function PatternCard({ pattern }: PatternCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 p-5 hover:border-zinc-700 transition-colors">
      {/* URL Pattern */}
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-mono text-emerald-400 truncate">
          {pattern.url_pattern}
        </span>
      </div>

      {/* Target */}
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-zinc-500" />
        <span className="text-sm text-zinc-300">{pattern.target}</span>
      </div>

      {/* Working Selector */}
      <div className="flex items-start gap-2 mb-4">
        <Code className="w-4 h-4 text-zinc-500 mt-0.5" />
        <span className="text-xs text-zinc-500 font-mono truncate">
          {pattern.working_selector}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Badge className={approachColors[pattern.approach] || approachColors.extract}>
          {pattern.approach}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          Used {pattern.success_count} time{pattern.success_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Learned timestamp */}
      <p className="text-xs text-zinc-600 mt-2">
        Learned {new Date(pattern.created_at).toLocaleDateString()}
      </p>
    </Card>
  );
}
```

---

### Step 5.10: Pattern Grid Component

**File: `src/components/pattern-grid.tsx`**

```tsx
"use client";

import { PatternCard } from "./pattern-card";
import type { PagePattern } from "@/lib/utils/types";

interface PatternGridProps {
  patterns: PagePattern[];
}

export function PatternGrid({ patterns }: PatternGridProps) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">No patterns learned yet.</p>
        <p className="text-zinc-600 text-sm mt-1">
          Run some tasks and WebScout will start learning!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {patterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  );
}
```

---

### Step 5.11: Dashboard Home Page

**File: `src/app/dashboard/page.tsx`**

```tsx
"use client";

import { useTasks } from "@/hooks/use-tasks";
import { StatsOverview } from "@/components/stats-overview";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data, isLoading, mutate } = useTasks();

  const defaultStats = {
    total: 0,
    successful: 0,
    failed: 0,
    cached: 0,
    recovered: 0,
    patterns_learned: 0,
    cache_hit_rate: "0%",
    recovery_rate: "N/A",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-zinc-500 mt-1">
          Monitor WebScout's learning progress and run new tasks
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-900" />
          ))}
        </div>
      ) : (
        <StatsOverview stats={data?.stats || defaultStats} />
      )}

      {/* Two-column: Form + Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskForm onTaskComplete={() => mutate()} />

        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent Tasks
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-zinc-900" />
              ))}
            </div>
          ) : (
            <TaskList tasks={data?.tasks?.slice(0, 5) || []} />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 5.12: Tasks List Page

**File: `src/app/tasks/page.tsx`**

```tsx
"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/task-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksPage() {
  const { data, isLoading } = useTasks();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">All Tasks</h2>
        <p className="text-zinc-500 mt-1">
          {data?.total || 0} total tasks executed
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 bg-zinc-900" />
          ))}
        </div>
      ) : (
        <TaskList tasks={data?.tasks || []} />
      )}
    </div>
  );
}
```

> **Note:** The tasks page shares the dashboard layout. Add this file:

**File: `src/app/tasks/layout.tsx`**

```tsx
import DashboardLayout from "@/app/dashboard/layout";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

---

### Step 5.13: Task Detail Page (with Trace Timeline)

**File: `src/app/tasks/[id]/page.tsx`**

```tsx
"use client";

import { useTask } from "@/hooks/use-tasks";
import { TraceTimeline } from "@/components/trace-timeline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Globe, Target, Clock, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { use } from "react";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: task, isLoading } = useTask(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-900" />
        <Skeleton className="h-32 bg-zinc-900" />
        <Skeleton className="h-64 bg-zinc-900" />
      </div>
    );
  }

  if (!task) {
    return <p className="text-zinc-500">Task not found</p>;
  }

  const duration = task.completed_at
    ? ((task.completed_at - task.created_at) / 1000).toFixed(1)
    : "...";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/tasks"
        className="text-sm text-zinc-500 hover:text-white flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Back to tasks
      </Link>

      {/* Task header */}
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-zinc-500" />
              <span className="text-sm text-zinc-400 font-mono">{task.url}</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-zinc-500" />
              <span className="text-lg text-white font-medium">{task.target}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {duration}s
              </span>
              <span>{task.steps.length} steps</span>
            </div>
          </div>

          <Badge
            className={
              task.status === "success"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }
          >
            {task.status === "success" ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : (
              <XCircle className="w-3 h-3 mr-1" />
            )}
            {task.status}
          </Badge>
        </div>

        {/* Result */}
        {task.result && (
          <div className="mt-4 p-3 rounded bg-zinc-800 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Extracted Data:</p>
            <pre className="text-sm text-emerald-400 whitespace-pre-wrap overflow-auto max-h-48">
              {JSON.stringify(task.result, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Trace Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Execution Trace
        </h3>
        <TraceTimeline steps={task.steps} screenshots={task.screenshots} />
      </div>
    </div>
  );
}
```

---

### Step 5.14: Patterns Page (Failure Recovery Library)

**File: `src/app/patterns/page.tsx`**

```tsx
"use client";

import { usePatterns } from "@/hooks/use-patterns";
import { PatternGrid } from "@/components/pattern-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain } from "lucide-react";

export default function PatternsPage() {
  const { data, isLoading } = usePatterns();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-400" />
          Failure Recovery Library
        </h2>
        <p className="text-zinc-500 mt-1">
          {data?.total || 0} patterns learned from past failures
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 bg-zinc-900" />
          ))}
        </div>
      ) : (
        <PatternGrid patterns={data?.patterns || []} />
      )}
    </div>
  );
}
```

**File: `src/app/patterns/layout.tsx`**

```tsx
import DashboardLayout from "@/app/dashboard/layout";

export default function PatternsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

---

### Step 5.15: Verify Phase 5

```bash
npm run dev
# Open http://localhost:3000
```

**Checklist:**
- [ ] Dashboard loads at `/dashboard` with stats row and empty task list
- [ ] Task form accepts URL + target, shows loading spinner during execution
- [ ] After task completes, task appears in recent tasks list with correct badge
- [ ] Clicking a task opens `/tasks/:id` with the trace timeline
- [ ] Trace timeline shows each step with icons, status badges, timestamps
- [ ] Screenshot thumbnails display and expand on click
- [ ] `/patterns` page shows learned patterns as a card grid
- [ ] SWR auto-refresh updates data every 5 seconds
- [ ] Dark theme looks polished throughout
- [ ] Color coding: green (success), red (failure), amber (recovery), blue (cached)

---

## Phase 6: Demo Preparation & Deployment

### Goal
Polish for the demo: seed data, deploy to Vercel, harden error handling, rehearse the 5-minute demo.

---

### Step 6.1: Error Handling Hardening

Go through each critical path and ensure graceful degradation:

**Redis failure:**
```typescript
// In scraper.ts, wrap Redis calls:
let cachedPatterns = [];
try {
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
```

**Browserbase failure:**
```typescript
// In stagehand-client.ts, add error context:
export async function createStagehand(): Promise<Stagehand> {
  try {
    const stagehand = new Stagehand({ /* ... */ });
    await stagehand.init();
    return stagehand;
  } catch (error) {
    throw new Error(
      `Failed to create browser session. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID. ` +
      `Original error: ${(error as Error).message}`
    );
  }
}
```

**Weave failure:**
```typescript
// Already handled — initWeave() catches and warns without throwing
```

---

### Step 6.2: Seed Demo Data

Run tasks against reliable public sites to populate the dashboard:

```bash
# Task 1: Book price (should succeed on first try)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", "target": "book title and price"}'

# Task 2: Different book (should use cached pattern)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html", "target": "book title and price"}'

# Task 3: Quotes
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://quotes.toscrape.com/", "target": "first quote text and author"}'

# Task 4: Different quote page (should use cached pattern)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://quotes.toscrape.com/page/2/", "target": "first quote text and author"}'
```

---

### Step 6.3: Deploy to Vercel

```bash
# 1. Initialize git
cd webscout
git init
git add .
git commit -m "Initial WebScout implementation"

# 2. Push to GitHub
gh repo create webscout --public --source=. --push

# 3. Import in Vercel
# Go to vercel.com/new, import the GitHub repo

# 4. Set environment variables in Vercel:
#    - BROWSERBASE_API_KEY
#    - BROWSERBASE_PROJECT_ID
#    - OPENAI_API_KEY
#    - REDIS_URL (use Redis Cloud or Upstash — NOT localhost)
#    - WANDB_API_KEY
#    - WEAVE_PROJECT=webscout

# 5. Deploy
vercel --prod
```

**Important:** Use **Redis Cloud** (free tier) or **Upstash Redis** for production. Not Docker.

**Vercel config for long-running tasks** — add to `next.config.ts`:

```typescript
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};
export default nextConfig;
```

And ensure API routes have `export const maxDuration = 60;`.

---

### Step 6.4: Demo Script (5 Minutes)

```
TIME  | ACTION
──────┼──────────────────────────────────────────────────
0:00  | INTRO
      | "Web scrapers break. Constantly. Every time a website
      |  updates its layout, your scraper dies. Here's why
      |  that ends today."
      |
0:30  | SHOW EMPTY DASHBOARD
      | Open WebScout dashboard. Show 0 tasks, 0 patterns.
      | "WebScout is a browser agent that learns from failures."
      |
0:45  | FIRST TASK (Fresh Attempt)
      | Submit: books.toscrape.com → "book title and price"
      | Watch loading spinner. Task completes.
      | Click into task detail → show trace timeline:
      |   Cache miss → Navigate → Extract → Success → Pattern stored
      | "It found the data and stored the pattern for next time."
      |
1:30  | SHOW PATTERN LEARNED
      | Go to Failure Recovery Library. Show the new pattern card.
      | "books.toscrape.com/catalogue/* → 'book title and price'"
      |
2:00  | SECOND TASK (Cache Hit)
      | Submit: DIFFERENT book URL on same site → same target
      | Watch it complete faster.
      | Click into task detail → trace shows:
      |   Cache HIT (95% match) → Cached extract → Success
      | "It remembered the pattern. No re-learning needed."
      |
2:45  | TRIGGER A FAILURE + RECOVERY
      | Submit a task on a site where initial extraction fails
      | (e.g., a page with cookie consent overlay).
      | Watch trace:
      |   Cache miss → Navigate → Extract FAILS →
      |   Recovery starts → Agent dismisses overlay →
      |   Extract succeeds → NEW PATTERN LEARNED
      | "It failed, analyzed why, fixed it, and will never
      |  fail the same way again."
      |
3:30  | SHOW WEAVE TRACES
      | Open W&B Weave dashboard. Show:
      |   - Nested operation tree (vectorSearch → browserInit → extract)
      |   - Screenshots captured at each step
      |   - Success/failure status on each op
      | "Every action is traced. Full observability."
      |
4:00  | SHOW DASHBOARD STATS
      | Return to WebScout dashboard:
      |   - N tasks run
      |   - N patterns learned
      |   - Cache hit rate: X%
      |   - Recovery rate: X%
      | "The more it runs, the smarter it gets."
      |
4:30  | CLOSING
      | "Traditional scrapers break and stay broken.
      |  WebScout breaks and gets smarter.
      |  Every failed click makes it smarter."
      |
5:00  | END
```

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Embedding model** | `text-embedding-3-small` (1536 dims) | Fast, cheap, sufficient for URL+target pattern matching |
| **Vector storage** | Redis + RediSearch HNSW index | Required sponsor integration; single DB for patterns + tasks |
| **Browser environment** | Browserbase (cloud) | No local browser needed; works on Vercel serverless |
| **Stagehand LLM** | `gpt-4o` | Best balance of speed + capability for browser automation |
| **Task execution** | Synchronous in API route | Simpler for hackathon; loading spinner in UI acceptable |
| **Dashboard data fetching** | SWR with 5s auto-refresh | No WebSocket complexity; good enough for live demo |
| **Tracing** | `weave.op` wrapping each major function | Shows nested trace tree in W&B dashboard |
| **Hosting** | Vercel | Required sponsor; native Next.js support |
| **Redis hosting (prod)** | Redis Cloud free tier or Upstash | No Docker dependency on demo machine |

---

## Risk Mitigation

| Risk | Impact | Fallback Plan |
|------|--------|---------------|
| Redis vector search setup too complex | Can't store/retrieve patterns | Use **Upstash Vector** (simpler dedicated API) |
| Stagehand unreliable on arbitrary sites | Demo failures | Demo ONLY on known-good sites (toscrape.com) |
| Vercel function timeout (10s on hobby) | Tasks killed mid-execution | Set `maxDuration = 60` or get Vercel Pro trial |
| Weave TS SDK missing features | Limited tracing | Use basic `weave.op` + manual logging |
| Browserbase rate limits | Can't run enough demo tasks | Pre-create sessions; limit demo to 5-6 tasks |
| Live site changes between prep and demo | Cached patterns break | Pre-seed patterns; have 3+ backup demo sites |
| Redis Cloud connection issues | No caching | Graceful degradation — scraper works without cache |

---

## Implementation Order (Critical Path)

```
Phase 1 (Scaffolding)
  │
  ▼
Phase 2 (Redis + Embeddings + Weave)
  │
  ▼
Phase 3 (Scraper Engine)  ← depends on Phase 2
  │
  ▼
Phase 4 (API Routes)      ← depends on Phase 3
  │
  ▼
Phase 5 (Dashboard UI)    ← depends on Phase 4
  │
  ▼
Phase 6 (Demo Prep)       ← depends on everything
```

**Parallel work (if team of 2):**
- **Person A:** Phase 1 → Phase 2 → Phase 3 → Phase 4 (backend)
- **Person B:** Phase 1 → Phase 5 (with mock data) → connect to real API → Phase 6
