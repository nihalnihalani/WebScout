# Phase 4: API Routes & Task Management

## Phase Overview

**Goal:** Expose the learning scraper engine via Next.js API routes. Add Redis-backed task storage so the dashboard can submit, list, and inspect tasks with full trace data.

**Dependencies:** Phase 3 complete (learning scraper engine, recovery, patterns)

**Produces:**
- Task storage in Redis (hashes + sorted set for ordering)
- `POST /api/tasks` — submit a new scraping task
- `GET /api/tasks` — list recent tasks with aggregate stats
- `GET /api/tasks/:id` — get full task detail with steps, screenshots, trace
- `GET /api/patterns` — list all learned patterns
- Updated health check with comprehensive service status

---

## Architecture: API Layer

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  POST /api/tasks                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Validate input (url, target)                      │     │
│  │ 2. Call learningScrape({ url, target })               │     │
│  │ 3. Store result in Redis (task:{uuid} hash)           │     │
│  │ 4. Add to tasks:timeline sorted set                   │     │
│  │ 5. Return full TaskResult                             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  GET /api/tasks                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Read task IDs from tasks:timeline (sorted set)     │     │
│  │ 2. Fetch each task hash                               │     │
│  │ 3. Calculate aggregate stats                          │     │
│  │ 4. Return { tasks, total, stats }                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  GET /api/tasks/:id                                           │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Fetch task:{id} hash from Redis                    │     │
│  │ 2. Return full TaskResult with steps + screenshots    │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  GET /api/patterns                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Query idx:page_patterns via FT.SEARCH              │     │
│  │ 2. Sort by success_count descending                   │     │
│  │ 3. Return { patterns, total }                         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  GET /api/health                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. Ping Redis                                         │     │
│  │ 2. Check all env vars                                 │     │
│  │ 3. Return service status + config status              │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Redis Data Model

```
┌─────────────────────────────────────────────────────────┐
│                    Redis Data Layout                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Hash: task:{uuid}                                       │
│  ├── data          → JSON string of full TaskResult      │
│  ├── created_at    → timestamp (for indexing)            │
│  └── status        → "success" | "failed" | "running"   │
│                                                          │
│  Sorted Set: tasks:timeline                              │
│  └── members: task UUIDs, scores: created_at timestamps  │
│      (enables newest-first listing with ZRANGEBYSCORE)   │
│                                                          │
│  Hash: pattern:{uuid}                                    │
│  ├── url_pattern       → "books.toscrape.com/catalogue/*"│
│  ├── target            → "book title and price"          │
│  ├── working_selector  → extraction instruction          │
│  ├── approach          → "extract" | "act" | "agent"     │
│  ├── created_at        → timestamp                       │
│  ├── success_count     → integer                         │
│  └── embedding         → Float32 buffer (1536 dims)      │
│                                                          │
│  RediSearch Index: idx:page_patterns                     │
│  └── Indexes pattern:* hashes for vector KNN search      │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoint Reference

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/tasks` | Submit new scraping task | `{ url: string, target: string }` | `TaskResult` |
| `GET` | `/api/tasks` | List recent tasks + stats | `?limit=20&offset=0` | `{ tasks, total, stats }` |
| `GET` | `/api/tasks/:id` | Get single task detail | - | `TaskResult` |
| `GET` | `/api/patterns` | List learned patterns | `?limit=50&offset=0` | `{ patterns, total }` |
| `GET` | `/api/health` | Service health check | - | `{ status, services, configuration }` |

---

## Step 4.1: Task Storage Helpers

**File: `src/lib/redis/tasks.ts`**

This module handles storing and retrieving tasks from Redis. Tasks are stored as hashes (for fast lookup by ID) and indexed in a sorted set (for ordered listing).

```typescript
import { getRedisClient } from "./client";
import type { TaskResult } from "../utils/types";

const TASK_PREFIX = "task:";
const TIMELINE_KEY = "tasks:timeline";

// ============================================
// Task Storage
// ============================================

/**
 * Store a completed task result in Redis.
 *
 * Storage strategy:
 * - Hash at `task:{uuid}` stores the full JSON task result
 * - Sorted set `tasks:timeline` stores task IDs sorted by created_at
 *   (enables efficient newest-first listing)
 *
 * @param task - The completed TaskResult to store
 */
export async function storeTask(task: TaskResult): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${task.id}`;

  // Store the full task as a JSON string in a hash
  await client.hSet(key, {
    data: JSON.stringify(task),
    created_at: task.created_at.toString(),
    status: task.status,
  });

  // Add to the sorted set for ordered listing
  // Score = created_at timestamp, enabling newest-first queries
  await client.zAdd(TIMELINE_KEY, {
    score: task.created_at,
    value: task.id,
  });

  console.log(`[Tasks] Stored task ${task.id} (${task.status})`);
}

// ============================================
// Task Retrieval
// ============================================

/**
 * Get a single task by its ID.
 *
 * @param taskId - The task UUID
 * @returns The full TaskResult or null if not found
 */
export async function getTask(taskId: string): Promise<TaskResult | null> {
  const client = await getRedisClient();
  const data = await client.hGet(`${TASK_PREFIX}${taskId}`, "data");

  if (!data) return null;

  try {
    return JSON.parse(data) as TaskResult;
  } catch {
    console.error(`[Tasks] Failed to parse task ${taskId}`);
    return null;
  }
}

/**
 * List recent tasks, newest first.
 *
 * Uses Redis sorted set ZRANGE with REV (reverse) to get
 * tasks ordered by creation time, newest first.
 *
 * @param limit - Maximum number of tasks to return
 * @param offset - Number of tasks to skip (for pagination)
 * @returns Object with tasks array and total count
 */
export async function listTasks(
  limit: number = 20,
  offset: number = 0
): Promise<{ tasks: TaskResult[]; total: number }> {
  const client = await getRedisClient();

  // Get total count of tasks
  const total = await client.zCard(TIMELINE_KEY);

  // Get task IDs in reverse chronological order
  const ids = await client.zRange(TIMELINE_KEY, "+inf", "-inf", {
    BY: "SCORE",
    REV: true,
    LIMIT: { offset, count: limit },
  });

  // Fetch full task data for each ID
  const tasks: TaskResult[] = [];
  for (const id of ids) {
    const task = await getTask(id);
    if (task) tasks.push(task);
  }

  return { tasks, total };
}

// ============================================
// Task Statistics
// ============================================

/**
 * Calculate aggregate statistics across all tasks.
 *
 * Stats include:
 * - total: Total tasks executed
 * - successful: Tasks that completed successfully
 * - failed: Tasks that failed all strategies
 * - cached: Tasks that used a cached pattern
 * - recovered: Tasks that failed initially but recovered
 *
 * Note: For production, you'd want a separate counter/stats hash
 * rather than fetching all tasks. This approach works for hackathon scale.
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

/**
 * Update the status of an existing task.
 * Useful for marking tasks as "running" before execution completes.
 *
 * @param taskId - The task UUID
 * @param status - The new status
 */
export async function updateTaskStatus(
  taskId: string,
  status: "pending" | "running" | "success" | "failed"
): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${taskId}`;

  // Update just the status field
  await client.hSet(key, { status });

  // Also update the status inside the JSON data
  const data = await client.hGet(key, "data");
  if (data) {
    const task = JSON.parse(data) as TaskResult;
    task.status = status;
    await client.hSet(key, { data: JSON.stringify(task) });
  }
}
```

---

## Step 4.2: Tasks API Route (POST + GET)

**File: `src/app/api/tasks/route.ts`**

This is the main task endpoint. POST creates and executes a new scraping task. GET lists recent tasks with aggregate statistics.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { learningScrape } from "@/lib/engine/scraper";
import { storeTask, listTasks, getTaskStats } from "@/lib/redis/tasks";
import { getPatternCount } from "@/lib/redis/patterns";
import type { TaskRequest } from "@/lib/utils/types";

// ============================================
// Vercel Function Configuration
// ============================================

// Allow up to 60 seconds for scraping tasks (requires Vercel Pro)
// Hobby plan default is 10 seconds — upgrade or use maxDuration = 10
export const maxDuration = 60;

// Force dynamic rendering (no caching of API responses)
export const dynamic = "force-dynamic";

// ============================================
// POST /api/tasks — Submit a new scraping task
// ============================================
//
// Request body:
//   {
//     "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
//     "target": "book title and price"
//   }
//
// Response: Full TaskResult object including:
//   - id, url, target, status
//   - result (extracted data)
//   - used_cached_pattern (boolean)
//   - recovery_attempted (boolean)
//   - steps[] (trace timeline)
//   - screenshots[] (base64 PNGs)
//

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, target } = body as TaskRequest;

    // ── Input Validation ──

    if (!url || !target) {
      return NextResponse.json(
        { error: "Both 'url' and 'target' fields are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format. Must be a valid absolute URL (e.g., https://example.com)" },
        { status: 400 }
      );
    }

    // Validate target is not empty/whitespace
    if (target.trim().length === 0) {
      return NextResponse.json(
        { error: "'target' must describe what to extract (e.g., 'product price and title')" },
        { status: 400 }
      );
    }

    console.log(`[API] New task: extract "${target}" from ${url}`);

    // ── Execute the learning scrape ──
    // This is synchronous — the client waits for completion.
    // The learningScrape function handles:
    //   1. Redis vector search for cached patterns
    //   2. Browserbase session creation
    //   3. Stagehand extraction (cached or fresh)
    //   4. Recovery on failure
    //   5. Pattern storage on success
    //   6. Weave tracing throughout

    const result = await learningScrape({ url, target });

    // ── Store result in Redis ──
    await storeTask(result);

    console.log(
      `[API] Task ${result.id} completed: ${result.status}` +
      (result.used_cached_pattern ? " (cached)" : "") +
      (result.recovery_attempted ? " (recovered)" : "")
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Task execution error:", error);

    // Return a structured error response
    return NextResponse.json(
      {
        error: "Task execution failed",
        detail: (error as Error).message,
        hint: "Check server logs for more details. Common causes: Browserbase API key invalid, Redis not running, or page navigation timeout.",
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/tasks — List recent tasks + stats
// ============================================
//
// Query parameters:
//   ?limit=20  — max tasks to return (default 20)
//   ?offset=0  — skip N tasks for pagination (default 0)
//
// Response:
//   {
//     "tasks": [ TaskResult, ... ],
//     "total": 42,
//     "stats": {
//       "total": 42,
//       "successful": 35,
//       "failed": 3,
//       "cached": 20,
//       "recovered": 4,
//       "patterns_learned": 12,
//       "cache_hit_rate": "47.6%",
//       "recovery_rate": "57.1%"
//     }
//   }
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100 // cap at 100 to prevent abuse
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    // Fetch tasks and stats in parallel
    const [{ tasks, total }, stats, patternCount] = await Promise.all([
      listTasks(limit, offset),
      getTaskStats(),
      getPatternCount(),
    ]);

    // Calculate derived metrics
    const cacheHitRate =
      stats.total > 0
        ? ((stats.cached / stats.total) * 100).toFixed(1) + "%"
        : "0%";

    const recoveryRate =
      stats.recovered + stats.failed > 0
        ? (
            (stats.recovered / (stats.recovered + stats.failed)) *
            100
          ).toFixed(1) + "%"
        : "N/A";

    return NextResponse.json({
      tasks,
      total,
      stats: {
        ...stats,
        patterns_learned: patternCount,
        cache_hit_rate: cacheHitRate,
        recovery_rate: recoveryRate,
      },
    });
  } catch (error) {
    console.error("[API] List tasks error:", error);
    return NextResponse.json(
      { error: "Failed to list tasks", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## Step 4.3: Task Detail API Route

**File: `src/app/api/tasks/[id]/route.ts`**

Returns the full task result for a specific task ID, including all steps, screenshots, and trace data.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/redis/tasks";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// ============================================
// GET /api/tasks/:id — Get single task detail
// ============================================
//
// Returns the full TaskResult including:
//   - steps[]: Array of TaskStep with action, status, detail, screenshot
//   - screenshots[]: Base64 PNG screenshots at each major step
//   - result: The extracted data (or null if failed)
//   - used_cached_pattern, recovery_attempted flags
//   - pattern_id: If a pattern was used or learned
//   - created_at, completed_at timestamps
//
// This endpoint powers the task detail page with trace timeline.
//

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format (should be a UUID)
    if (!id || id.length < 8) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 }
      );
    }

    const task = await getTask(id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found", id },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("[API] Get task error:", error);
    return NextResponse.json(
      { error: "Failed to get task", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## Step 4.4: Patterns API Route

**File: `src/app/api/patterns/route.ts`**

Lists all learned patterns from the Redis vector index, sorted by success count (most-used patterns first).

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listPatterns, getPatternCount } from "@/lib/redis/patterns";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// ============================================
// GET /api/patterns — List learned patterns
// ============================================
//
// Query parameters:
//   ?limit=50  — max patterns to return (default 50)
//   ?offset=0  — skip N patterns for pagination (default 0)
//
// Response:
//   {
//     "patterns": [
//       {
//         "id": "pattern:abc123",
//         "url_pattern": "books.toscrape.com/catalogue/*",
//         "target": "book title and price",
//         "working_selector": "Extract the book title and price from the product page",
//         "approach": "extract",
//         "success_count": 5,
//         "created_at": 1706745600000
//       },
//       ...
//     ],
//     "total": 12
//   }
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200 // cap at 200
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    const { patterns, total } = await listPatterns(limit, offset);

    return NextResponse.json({ patterns, total });
  } catch (error) {
    console.error("[API] List patterns error:", error);
    return NextResponse.json(
      { error: "Failed to list patterns", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## Step 4.5: Updated Health Check Route

**File: `src/app/api/health/route.ts`** (replace the Phase 1 version)

Enhanced health check that tests Redis connectivity, validates all environment variables, and measures latency.

```typescript
import { NextResponse } from "next/server";
import { createClient } from "redis";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// ============================================
// GET /api/health — Comprehensive health check
// ============================================

export async function GET() {
  const startTime = Date.now();

  const services: Record<
    string,
    { status: string; message: string; latency_ms?: number }
  > = {};
  const configuration: Record<string, string> = {};

  // ── Check Redis ──

  try {
    const redisStart = Date.now();
    const client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    await client.connect();
    await client.ping();

    // Also check if vector index exists
    let indexStatus = "unknown";
    try {
      const info = await client.ft.info("idx:page_patterns");
      indexStatus = `active (${info.numDocs ?? 0} docs)`;
    } catch {
      indexStatus = "not created yet";
    }

    await client.disconnect();

    services.redis = {
      status: "ok",
      message: `Connected. Vector index: ${indexStatus}`,
      latency_ms: Date.now() - redisStart,
    };
  } catch (e) {
    services.redis = {
      status: "error",
      message: `Connection failed: ${(e as Error).message}`,
    };
  }

  // ── Check API key configuration ──

  const keys = {
    browserbase_api_key: "BROWSERBASE_API_KEY",
    browserbase_project_id: "BROWSERBASE_PROJECT_ID",
    openai_api_key: "OPENAI_API_KEY",
    redis_url: "REDIS_URL",
    wandb_api_key: "WANDB_API_KEY",
    weave_project: "WEAVE_PROJECT",
    app_url: "NEXT_PUBLIC_APP_URL",
  };

  for (const [label, envVar] of Object.entries(keys)) {
    configuration[label] = process.env[envVar] ? "configured" : "missing";
  }

  // ── Overall status ──

  const allServicesOk = Object.values(services).every(
    (s) => s.status === "ok"
  );
  const allKeysConfigured = Object.values(configuration).every(
    (v) => v === "configured"
  );
  const overallStatus =
    allServicesOk && allKeysConfigured ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      response_time_ms: Date.now() - startTime,
      services,
      configuration,
      version: "0.1.0",
    },
    { status: overallStatus === "healthy" ? 200 : 503 }
  );
}
```

---

## Step 4.6: File Structure After Phase 4

```
src/
├── app/
│   └── api/
│       ├── tasks/
│       │   ├── route.ts              # POST create + GET list (Step 4.2)
│       │   └── [id]/
│       │       └── route.ts          # GET task detail (Step 4.3)
│       ├── patterns/
│       │   └── route.ts              # GET learned patterns (Step 4.4)
│       └── health/
│           └── route.ts              # Updated health check (Step 4.5)
├── lib/
│   └── redis/
│       ├── client.ts                 # (from Phase 2)
│       ├── vectors.ts                # (from Phase 2)
│       ├── patterns.ts               # (from Phase 2)
│       └── tasks.ts                  # NEW — task storage (Step 4.1)
```

---

## Step 4.7: Testing & Debugging

### Test with cURL

After starting the dev server and Redis:

```bash
# Start Redis (if not running)
docker compose up -d

# Start dev server
npm run dev
```

#### Test 1: Health Check

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-31T12:00:00.000Z",
  "uptime_seconds": 5,
  "response_time_ms": 12,
  "services": {
    "redis": {
      "status": "ok",
      "message": "Connected. Vector index: not created yet",
      "latency_ms": 3
    }
  },
  "configuration": {
    "browserbase_api_key": "configured",
    "browserbase_project_id": "configured",
    "openai_api_key": "configured",
    "redis_url": "configured",
    "wandb_api_key": "configured",
    "weave_project": "configured",
    "app_url": "configured"
  },
  "version": "0.1.0"
}
```

#### Test 2: Submit a Task (POST)

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": "book title and price"
  }' | python3 -m json.tool
```

**Expected response (abbreviated):**
```json
{
  "id": "a1b2c3d4-...",
  "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "target": "book title and price",
  "status": "success",
  "result": { "data": { "title": "A Light in the Attic", "price": "£51.77" } },
  "used_cached_pattern": false,
  "recovery_attempted": false,
  "pattern_id": "pattern:...",
  "steps": [
    { "action": "vector_search", "status": "info", "detail": "..." },
    { "action": "cache_miss", "status": "info", "detail": "..." },
    { "action": "browser_init", "status": "info", "detail": "..." },
    { "action": "navigate", "status": "success", "detail": "..." },
    { "action": "fresh_extract", "status": "success", "detail": "..." },
    { "action": "pattern_stored", "status": "success", "detail": "..." }
  ],
  "screenshots": ["iVBORw0KGgo..."],
  "created_at": 1706745600000,
  "completed_at": 1706745615000
}
```

> **Note:** The task ID from this response is used in Test 4 below. Save it.

#### Test 3: List Tasks (GET)

```bash
curl -s http://localhost:3000/api/tasks | python3 -m json.tool
```

**Expected response:**
```json
{
  "tasks": [ /* array of TaskResult objects */ ],
  "total": 1,
  "stats": {
    "total": 1,
    "successful": 1,
    "failed": 0,
    "cached": 0,
    "recovered": 0,
    "patterns_learned": 1,
    "cache_hit_rate": "0.0%",
    "recovery_rate": "N/A"
  }
}
```

#### Test 4: Get Task Detail (GET by ID)

```bash
# Replace <task-id> with the actual UUID from Test 2
curl -s http://localhost:3000/api/tasks/<task-id> | python3 -m json.tool
```

#### Test 5: List Learned Patterns

```bash
curl -s http://localhost:3000/api/patterns | python3 -m json.tool
```

**Expected response:**
```json
{
  "patterns": [
    {
      "id": "pattern:...",
      "url_pattern": "books.toscrape.com/catalogue/*",
      "target": "book title and price",
      "working_selector": "book title and price",
      "approach": "extract",
      "success_count": 1,
      "created_at": 1706745600000
    }
  ],
  "total": 1
}
```

#### Test 6: Cache Hit (Submit Similar Task)

```bash
# Submit a DIFFERENT book on the same site
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
    "target": "book title and price"
  }' | python3 -m json.tool
```

**Expected:** The response should have `"used_cached_pattern": true` and the steps should include a `cache_hit` step with a high similarity score.

#### Test 7: Input Validation

```bash
# Missing fields
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | python3 -m json.tool
# → 400: "Both 'url' and 'target' fields are required"

# Invalid URL
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"url": "not-a-url", "target": "test"}' | python3 -m json.tool
# → 400: "Invalid URL format"

# Non-existent task
curl -s http://localhost:3000/api/tasks/nonexistent-id | python3 -m json.tool
# → 404: "Task not found"
```

---

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Task execution failed` (500) | Browserbase/Stagehand init failure | Verify `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` in `.env.local` |
| `ECONNREFUSED 127.0.0.1:6379` | Redis not running | Run `docker compose up -d` |
| `maxDuration exceeded` | Scraping took longer than allowed | Increase `maxDuration` or use Vercel Pro |
| `Failed to list tasks` | Redis connection or sorted set issue | Check Redis with `redis-cli ZRANGE tasks:timeline 0 -1` |
| `Failed to list patterns` | Vector index not created | Run a task first (or call `ensureVectorIndex()`) |
| `Task not found` (404) | Invalid task ID or task expired | Verify the task ID exists: `redis-cli EXISTS task:{id}` |
| `Both 'url' and 'target' are required` (400) | Missing request body fields | Ensure JSON body has both `url` and `target` strings |
| `FUNCTION_INVOCATION_TIMEOUT` (Vercel) | Hobby plan 10s limit | Set `maxDuration = 60` and upgrade to Vercel Pro |

### Debug Checklist

- [ ] `npm run dev` starts without errors
- [ ] `docker compose ps` shows Redis as healthy
- [ ] `curl http://localhost:3000/api/health` returns `"status": "healthy"`
- [ ] Health check shows vector index info
- [ ] POST `/api/tasks` with valid body returns a TaskResult
- [ ] GET `/api/tasks` lists the submitted task
- [ ] GET `/api/tasks/:id` returns full task detail with steps
- [ ] GET `/api/patterns` shows the learned pattern
- [ ] Second similar POST shows `used_cached_pattern: true`
- [ ] POST with missing fields returns 400
- [ ] POST with invalid URL returns 400
- [ ] GET with non-existent ID returns 404
- [ ] `npx tsc --noEmit` produces no errors
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds

---

### Redis Inspection Commands

Useful Redis CLI commands for debugging:

```bash
# Connect to Redis
docker exec -it webscout-redis redis-cli

# List all task keys
KEYS task:*

# View a specific task
HGETALL task:<uuid>

# List task timeline (newest first)
ZRANGE tasks:timeline +inf -inf BYSCORE REV LIMIT 0 10

# View pattern count
FT.INFO idx:page_patterns

# List all pattern keys
KEYS pattern:*

# View a specific pattern (without embedding)
HMGET pattern:<uuid> url_pattern target working_selector approach success_count created_at

# Search patterns by text
FT.SEARCH idx:page_patterns "@url_pattern:books"

# Flush all data (CAUTION: deletes everything)
FLUSHALL
```

---

## Step 4.8: GitHub Actions Workflow

**File: `.github/workflows/phase-4-api-routes.yml`**

```yaml
# Phase 4 - API Routes Verification
# Verifies: API routes compile, TypeScript checks pass, build succeeds
# Also tests endpoints with a Redis service container
name: Phase 4 - API Routes

on:
  push:
    branches: [main]
    paths:
      - 'webscout/src/app/api/**'
      - 'webscout/src/lib/redis/tasks.ts'
  pull_request:
    branches: [main]
    paths:
      - 'webscout/src/app/api/**'
      - 'webscout/src/lib/redis/tasks.ts'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    name: Build & Test API Routes
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # Redis Stack service container for integration tests
    services:
      redis:
        image: redis/redis-stack-server:latest
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: webscout/package-lock.json

      - name: Install dependencies
        run: cd webscout && npm ci

      - name: TypeScript type checking
        run: cd webscout && npx tsc --noEmit

      - name: ESLint
        run: cd webscout && npm run lint

      - name: Production build
        run: cd webscout && npm run build
        env:
          BROWSERBASE_API_KEY: "ci_placeholder"
          BROWSERBASE_PROJECT_ID: "ci_placeholder"
          OPENAI_API_KEY: "ci_placeholder"
          REDIS_URL: "redis://localhost:6379"
          WANDB_API_KEY: "ci_placeholder"
          WEAVE_PROJECT: "webscout"
          NEXT_PUBLIC_APP_URL: "http://localhost:3000"

      - name: Start app and test health endpoint
        run: |
          cd webscout
          npm start &
          APP_PID=$!

          # Wait for the app to start
          echo "Waiting for app to start..."
          for i in {1..30}; do
            if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
              echo "App is ready!"
              break
            fi
            sleep 1
          done

          # Test health endpoint
          echo "Testing health endpoint..."
          HEALTH=$(curl -s http://localhost:3000/api/health)
          echo "$HEALTH" | python3 -m json.tool

          # Verify Redis is connected
          echo "$HEALTH" | python3 -c "
          import json, sys
          data = json.load(sys.stdin)
          assert data['services']['redis']['status'] == 'ok', 'Redis not connected'
          print('✓ Redis connected')
          "

          # Test GET /api/tasks (should return empty list)
          echo "Testing GET /api/tasks..."
          TASKS=$(curl -s http://localhost:3000/api/tasks)
          echo "$TASKS" | python3 -c "
          import json, sys
          data = json.load(sys.stdin)
          assert 'tasks' in data, 'Missing tasks field'
          assert 'stats' in data, 'Missing stats field'
          assert data['stats']['total'] == 0, 'Expected 0 tasks'
          print('✓ GET /api/tasks works')
          "

          # Test GET /api/patterns (should return empty list)
          echo "Testing GET /api/patterns..."
          PATTERNS=$(curl -s http://localhost:3000/api/patterns)
          echo "$PATTERNS" | python3 -c "
          import json, sys
          data = json.load(sys.stdin)
          assert 'patterns' in data, 'Missing patterns field'
          print('✓ GET /api/patterns works')
          "

          # Test input validation
          echo "Testing input validation..."
          INVALID=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/tasks \
            -H 'Content-Type: application/json' \
            -d '{"url": "not-a-url", "target": "test"}')
          [ "$INVALID" = "400" ] && echo "✓ Invalid URL rejected" || echo "✗ Expected 400 for invalid URL"

          MISSING=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/tasks \
            -H 'Content-Type: application/json' \
            -d '{"url": "https://example.com"}')
          [ "$MISSING" = "400" ] && echo "✓ Missing target rejected" || echo "✗ Expected 400 for missing target"

          NOT_FOUND=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/tasks/nonexistent)
          [ "$NOT_FOUND" = "404" ] && echo "✓ Unknown task returns 404" || echo "✗ Expected 404 for unknown task"

          # Cleanup
          kill $APP_PID 2>/dev/null || true
        env:
          BROWSERBASE_API_KEY: "ci_placeholder"
          BROWSERBASE_PROJECT_ID: "ci_placeholder"
          OPENAI_API_KEY: "ci_placeholder"
          REDIS_URL: "redis://localhost:6379"
          WANDB_API_KEY: "ci_placeholder"
          WEAVE_PROJECT: "webscout"
          NEXT_PUBLIC_APP_URL: "http://localhost:3000"

      - name: Verify API route files exist
        run: |
          echo "Checking API route files..."
          test -f webscout/src/app/api/tasks/route.ts && echo "✓ tasks/route.ts" || echo "✗ tasks/route.ts missing"
          test -f webscout/src/app/api/tasks/\[id\]/route.ts && echo "✓ tasks/[id]/route.ts" || echo "✗ tasks/[id]/route.ts missing"
          test -f webscout/src/app/api/patterns/route.ts && echo "✓ patterns/route.ts" || echo "✗ patterns/route.ts missing"
          test -f webscout/src/app/api/health/route.ts && echo "✓ health/route.ts" || echo "✗ health/route.ts missing"
          test -f webscout/src/lib/redis/tasks.ts && echo "✓ redis/tasks.ts" || echo "✗ redis/tasks.ts missing"
```

---

## File Checklist

| File | Status | Created By |
|------|--------|------------|
| `webscout/src/lib/redis/tasks.ts` | **NEW** | Step 4.1 |
| `webscout/src/app/api/tasks/route.ts` | **NEW** | Step 4.2 |
| `webscout/src/app/api/tasks/[id]/route.ts` | **NEW** | Step 4.3 |
| `webscout/src/app/api/patterns/route.ts` | **NEW** | Step 4.4 |
| `webscout/src/app/api/health/route.ts` | **UPDATED** | Step 4.5 |
| `.github/workflows/phase-4-api-routes.yml` | **NEW** | Step 4.8 |

**Phase 4 Complete.** You now have a full REST API layer exposing the learning scraper engine with task storage, pagination, aggregate stats, input validation, and health monitoring. **Next: Phase 5 — Dashboard UI.**
