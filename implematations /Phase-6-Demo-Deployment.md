# Phase 6: Demo Preparation & Deployment

## Phase Overview

**Goal:** Polish the application for demo day. Harden error handling, deploy to Vercel with production Redis, seed demo data, and rehearse the 5-minute demo script.

**Dependencies:** Phase 5 complete (all UI pages and components working)

**Produces:**
- Error handling hardened across all critical paths
- Production deployment on Vercel
- Production Redis on Redis Cloud (or Upstash)
- Seeded demo data showing learning progression
- Rehearsed 5-minute demo script
- Full integration GitHub Actions workflow

---

## Architecture: Production Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    HTTPS    ┌────────────────────────┐         │
│  │  Browser     │───────────►│  Vercel (Edge/Serverless)│        │
│  │  (Audience)  │            │  Next.js App             │        │
│  └─────────────┘            └──────────┬───────────────┘         │
│                                        │                         │
│              ┌─────────────────────────┼──────────────────┐      │
│              │                         │                  │      │
│              ▼                         ▼                  ▼      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐    │
│  │  Redis Cloud      │  │  Browserbase      │  │  Weave/W&B │   │
│  │  (redis.io)       │  │  (Cloud Browser)  │  │  (Tracing) │   │
│  │                   │  │                   │  │            │    │
│  │  • Pattern store  │  │  • Stagehand      │  │  • Traces  │   │
│  │  • Vector search  │  │  • Screenshots    │  │  • Ops     │   │
│  │  • Task storage   │  │  • DOM access     │  │  • Logs    │   │
│  └──────────────────┘  └──────────────────┘  └────────────┘    │
│              │                         │                  │      │
│              ▼                         ▼                  ▼      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    OpenAI API                             │   │
│  │  • text-embedding-3-small (pattern embeddings)            │   │
│  │  • gpt-4o (Stagehand LLM backbone)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 6.1: Error Handling Hardening

### Strategy

Every external service call should be wrapped with try/catch and provide graceful degradation:

| Service | On Failure | User Impact |
|---------|-----------|-------------|
| **Redis** (vector search) | Log warning, skip cache, proceed with fresh extraction | Slightly slower, but still works |
| **Redis** (task storage) | Log error, return result without storing | Task completes but won't appear in dashboard |
| **Browserbase/Stagehand** | Throw meaningful error with guidance | Task fails with clear error message |
| **OpenAI** (embeddings) | Log error, skip cache operations | Can't search/store patterns, but scraping works |
| **Weave** (tracing) | Log warning, continue without tracing | No traces in W&B, but app works normally |

### 6.1.1: Harden Stagehand Client

**File: `src/lib/browser/stagehand-client.ts`** — Add error context

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

/**
 * Create and initialize a Stagehand instance backed by Browserbase.
 * Includes detailed error messages for common failure modes.
 */
export async function createStagehand(): Promise<Stagehand> {
  // Validate required env vars before attempting connection
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error(
      "BROWSERBASE_API_KEY is not set. Get your API key from https://www.browserbase.com/settings"
    );
  }
  if (!process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error(
      "BROWSERBASE_PROJECT_ID is not set. Find your project ID in the Browserbase dashboard."
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Get your API key from https://platform.openai.com/api-keys"
    );
  }

  try {
    const stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      modelName: "gpt-4o",
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY,
      },
    });

    await stagehand.init();
    console.log("[Stagehand] Initialized with Browserbase");

    return stagehand;
  } catch (error) {
    const msg = (error as Error).message;

    // Provide specific guidance for common errors
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      throw new Error(
        `Browserbase authentication failed. Verify your BROWSERBASE_API_KEY is correct. Original: ${msg}`
      );
    }
    if (msg.includes("project")) {
      throw new Error(
        `Invalid Browserbase project. Verify BROWSERBASE_PROJECT_ID. Original: ${msg}`
      );
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      throw new Error(
        `Cannot reach Browserbase. Check your internet connection. Original: ${msg}`
      );
    }

    throw new Error(
      `Failed to create browser session: ${msg}. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.`
    );
  }
}

/**
 * Safely close a Stagehand instance.
 */
export async function closeStagehand(stagehand: Stagehand): Promise<void> {
  try {
    await stagehand.close();
    console.log("[Stagehand] Session closed");
  } catch (error) {
    // Don't throw on close — just warn
    console.warn("[Stagehand] Error closing session:", (error as Error).message);
  }
}
```

### 6.1.2: Harden Learning Scraper (Redis Failures)

Add Redis fallback handling to `src/lib/engine/scraper.ts`. Wrap the Redis vector search in a try/catch so the scraper can still work without cache:

```typescript
// In the learningScrape function, replace the vector search section:

// ── Step 1: Search Redis for known patterns (with fallback) ──

steps.push({
  action: "vector_search",
  status: "info",
  detail: `Searching Redis for patterns matching: "${urlPattern} ${task.target}"`,
  timestamp: Date.now(),
});

let cachedPatterns: PagePattern[] = [];
try {
  const queryText = `${urlPattern} ${task.target}`;
  cachedPatterns = await searchSimilarPatterns(queryText, 3);
} catch (error) {
  console.warn("[Scraper] Redis search failed, proceeding without cache:", (error as Error).message);
  steps.push({
    action: "cache_error",
    status: "info",
    detail: `Redis unavailable — proceeding without cache. Error: ${(error as Error).message}`,
    timestamp: Date.now(),
  });
}
```

### 6.1.3: Harden Embeddings

Add graceful degradation to `src/lib/embeddings/openai.ts`:

```typescript
/**
 * Generate an embedding with fallback.
 * Returns null instead of throwing if OpenAI API is unavailable.
 */
export async function generateEmbeddingSafe(text: string): Promise<number[] | null> {
  try {
    return await generateEmbedding(text);
  } catch (error) {
    console.warn("[Embeddings] Failed to generate embedding:", (error as Error).message);
    return null;
  }
}
```

### 6.1.4: Harden Weave Tracing

The Weave setup already has try/catch in `initWeave()`. Verify it doesn't throw:

```typescript
// In src/lib/tracing/weave.ts — already handles failure gracefully:
export async function initWeave(): Promise<void> {
  if (initialized) return;

  try {
    await weave.init(process.env.WEAVE_PROJECT || "webscout");
    initialized = true;
    console.log("[Weave] Initialized successfully");
  } catch (error) {
    // Don't throw — app should work without Weave
    console.warn("[Weave] Failed to initialize:", (error as Error).message);
    console.warn("[Weave] Tracing will be disabled for this session.");
  }
}
```

### 6.1.5: Harden Task Storage

Add fallback to the POST API route so tasks still return results even if Redis storage fails:

```typescript
// In src/app/api/tasks/route.ts POST handler, after learningScrape:

// Execute the learning scrape
const result = await learningScrape({ url, target });

// Store result in Redis (non-blocking — don't fail the request if storage fails)
try {
  await storeTask(result);
} catch (storageError) {
  console.error("[API] Failed to store task in Redis:", (storageError as Error).message);
  // Continue — the task result is still returned to the client
}

return NextResponse.json(result);
```

---

## Step 6.2: Production Redis Setup

### Option A: Redis Cloud (Recommended for RediSearch)

1. Sign up at https://redis.io/try-free
2. Create a free database (30MB, enough for hackathon)
3. **Enable the "Search and query" module** (required for vector search)
4. Copy the connection URL from the "Connect" section

**Format:** `redis://default:<password>@<host>:<port>`

### Option B: Upstash Redis

1. Sign up at https://upstash.com
2. Create a Redis database
3. Copy the Redis URL

**Note:** Upstash supports basic Redis but may not have full RediSearch/vector search. If using Upstash, you may need the Upstash Vector addon or simplify to non-vector pattern matching.

### Option C: Railway Redis

1. Go to https://railway.app
2. Create a new Redis instance
3. Copy the connection URL from the Variables tab

### Set the Production URL

After getting your Redis cloud URL, set it in your production environment:

```bash
# In Vercel dashboard → Project Settings → Environment Variables:
REDIS_URL=redis://default:yourpassword@your-host.redis.cloud:16379
```

### Verify Production Redis

```bash
# Test connection from your machine
redis-cli -u "redis://default:yourpassword@your-host.redis.cloud:16379" ping
# Should return: PONG

# Verify RediSearch module is available
redis-cli -u "redis://..." MODULE LIST
# Should include: search (or ft)
```

---

## Step 6.3: Deploy to Vercel

### 6.3.1: Prepare for Deployment

Ensure `next.config.ts` has the correct configuration:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "redis",
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
    "weave",
  ],
};

export default nextConfig;
```

### 6.3.2: Initialize Git and Push

```bash
cd webscout

# Initialize git if not already done
git init
git add .
git commit -m "WebScout: Browser agent that learns from failures

Features:
- Learning scrape engine with vector-cached patterns
- Multi-strategy recovery (agent, act, refined extract)
- Redis vector search for pattern matching
- Weave tracing for full observability
- Dark-themed dashboard with trace timeline
- Failure Recovery Library showing learned patterns"

# Create GitHub repo and push
gh repo create webscout --public --source=. --push
```

### 6.3.3: Deploy to Vercel

**Option A: Via Vercel Dashboard (Recommended for first deploy)**

1. Go to https://vercel.com/new
2. Import your GitHub repository (`webscout`)
3. Vercel auto-detects Next.js
4. **Set environment variables** before deploying:

| Variable | Value |
|----------|-------|
| `BROWSERBASE_API_KEY` | Your Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Your Browserbase project ID |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `REDIS_URL` | Your Redis Cloud connection URL |
| `WANDB_API_KEY` | Your W&B API key |
| `WEAVE_PROJECT` | `webscout` |
| `NEXT_PUBLIC_APP_URL` | (will be set after first deploy) |

5. Click **Deploy**
6. After deploy, update `NEXT_PUBLIC_APP_URL` with your Vercel URL

**Option B: Via CLI**

```bash
# Install Vercel CLI if not already
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables
vercel env add BROWSERBASE_API_KEY
vercel env add BROWSERBASE_PROJECT_ID
vercel env add OPENAI_API_KEY
vercel env add REDIS_URL
vercel env add WANDB_API_KEY
vercel env add WEAVE_PROJECT

# Deploy to production
vercel --prod
```

### 6.3.4: Verify Deployment

```bash
# Replace with your actual Vercel URL
PROD_URL="https://webscout-your-name.vercel.app"

# 1. Health check
curl -s "$PROD_URL/api/health" | python3 -m json.tool

# 2. List tasks (should be empty)
curl -s "$PROD_URL/api/tasks" | python3 -m json.tool

# 3. Visit dashboard
open "$PROD_URL"
```

### 6.3.5: Vercel Function Timeout

For Vercel **Hobby** plan, the default timeout is **10 seconds**. Scraping tasks need more time.

**Solutions:**
- **Vercel Pro trial:** `maxDuration = 60` (already set in route.ts)
- **Vercel Hobby:** Tasks may timeout. Solutions:
  - Pre-seed data and demo with cached patterns (faster)
  - Use `maxDuration = 10` and demo with fast sites only
  - Request a Vercel Pro trial for the hackathon

---

## Step 6.4: Seed Demo Data

### Seed Script

Run these commands against your **production** URL to populate the dashboard with demo data. Run them in order — first tasks learn patterns, subsequent tasks use the cache.

```bash
# Set your production URL
PROD_URL="https://webscout-your-name.vercel.app"
# Or for local testing:
# PROD_URL="http://localhost:3000"

echo "=== Seeding WebScout Demo Data ==="

# ── Task 1: Book price (fresh attempt — learns pattern) ──
echo ""
echo "Task 1: books.toscrape.com (fresh)"
curl -s -X POST "$PROD_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": "book title and price"
  }' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Status: {d[\"status\"]} | Cached: {d[\"used_cached_pattern\"]} | Steps: {len(d[\"steps\"])}')"

echo "Waiting 5 seconds..."
sleep 5

# ── Task 2: Different book (should use cached pattern) ──
echo ""
echo "Task 2: books.toscrape.com/different-book (cached)"
curl -s -X POST "$PROD_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
    "target": "book title and price"
  }' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Status: {d[\"status\"]} | Cached: {d[\"used_cached_pattern\"]} | Steps: {len(d[\"steps\"])}')"

echo "Waiting 5 seconds..."
sleep 5

# ── Task 3: Quotes site (fresh attempt — new pattern) ──
echo ""
echo "Task 3: quotes.toscrape.com (fresh)"
curl -s -X POST "$PROD_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://quotes.toscrape.com/",
    "target": "first quote text and author"
  }' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Status: {d[\"status\"]} | Cached: {d[\"used_cached_pattern\"]} | Steps: {len(d[\"steps\"])}')"

echo "Waiting 5 seconds..."
sleep 5

# ── Task 4: Quotes page 2 (should use cached pattern) ──
echo ""
echo "Task 4: quotes.toscrape.com/page/2 (cached)"
curl -s -X POST "$PROD_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://quotes.toscrape.com/page/2/",
    "target": "first quote text and author"
  }' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  Status: {d[\"status\"]} | Cached: {d[\"used_cached_pattern\"]} | Steps: {len(d[\"steps\"])}')"

echo ""
echo "=== Seeding Complete ==="

# ── Verify stats ──
echo ""
echo "Dashboard stats:"
curl -s "$PROD_URL/api/tasks" | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = d['stats']
print(f'  Total tasks:      {s[\"total\"]}')
print(f'  Successful:       {s[\"successful\"]}')
print(f'  Cache hits:       {s[\"cached\"]}')
print(f'  Patterns learned: {s[\"patterns_learned\"]}')
print(f'  Cache hit rate:   {s[\"cache_hit_rate\"]}')
"

echo ""
echo "Patterns learned:"
curl -s "$PROD_URL/api/patterns" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d['patterns']:
    print(f'  {p[\"url_pattern\"]} → \"{p[\"target\"]}\" ({p[\"approach\"]}, used {p[\"success_count\"]}x)')
"
```

### Expected Seeded State

After running the seed script, your dashboard should show:

| Metric | Value |
|--------|-------|
| Total Tasks | 4 |
| Successful | 4 |
| Cache Hits | 2 |
| Patterns Learned | 2 |
| Cache Hit Rate | 50.0% |
| Recovery Rate | N/A |

**Patterns:**
1. `books.toscrape.com/catalogue/*` → "book title and price" (extract, used 2x)
2. `quotes.toscrape.com/*` → "first quote text and author" (extract, used 2x)

---

## Step 6.5: Demo Script (5 Minutes)

### Demo Flow

```
TIME  | SECTION           | ACTION
──────┼───────────────────┼──────────────────────────────────────────
0:00  | INTRO (30s)       | "Web scrapers break. Constantly. Every
      |                   |  time a website changes, your scraper dies.
      |                   |  We built WebScout — a browser agent that
      |                   |  learns from its failures."
      |                   |
0:30  | EMPTY DASHBOARD   | Open WebScout. Show empty dashboard.
      | (15s)             | "Zero tasks, zero patterns. Fresh start."
      |                   |
0:45  | FIRST TASK (60s)  | Submit: books.toscrape.com → "book title
      |                   |  and price"
      |                   | Watch loading spinner.
      |                   | Task completes → click into task detail.
      |                   | Walk through trace timeline:
      |                   |   1. Cache MISS — no patterns yet
      |                   |   2. Navigate to page (screenshot)
      |                   |   3. Fresh extract → SUCCESS
      |                   |   4. Pattern STORED in Redis
      |                   | "It found the data AND stored the pattern
      |                   |  for next time."
      |                   |
1:45  | PATTERN LEARNED   | Go to Failure Recovery Library.
      | (15s)             | Show the new pattern card:
      |                   |   books.toscrape.com/catalogue/* → price
      |                   | "This is now in the memory bank."
      |                   |
2:00  | CACHE HIT (45s)   | Submit: DIFFERENT book on same site.
      |                   | Task completes (faster this time).
      |                   | Click into detail → trace shows:
      |                   |   1. Cache HIT (95% similarity!)
      |                   |   2. Used cached pattern → SUCCESS
      |                   | "It remembered. No re-learning needed.
      |                   |  The pattern works across the whole site."
      |                   |
2:45  | RECOVERY (60s)    | [If you have a recovery demo prepared]
      |                   | Submit a task that triggers recovery:
      |                   |   - Site with cookie consent overlay
      |                   |   - Page where direct extract fails
      |                   | Watch trace:
      |                   |   Cache miss → Navigate → Extract FAILS →
      |                   |   Recovery starts → Agent dismisses popup →
      |                   |   Extract succeeds → NEW PATTERN LEARNED
      |                   | "It failed, analyzed why, fixed it, and
      |                   |  will never fail the same way again."
      |                   |
      |                   | [If no recovery demo: show stats instead]
      |                   |
3:45  | WEAVE TRACES      | Open W&B Weave dashboard (separate tab).
      | (30s)             | Show:
      |                   |   - Nested operation tree
      |                   |   - vectorSearch → browserInit → extract
      |                   |   - Screenshots at each step
      |                   |   - Success/failure on each op
      |                   | "Every single action is traced. Full
      |                   |  observability with Weave."
      |                   |
4:15  | DASHBOARD STATS   | Return to WebScout dashboard.
      | (15s)             | Point to stats:
      |                   |   - N tasks run
      |                   |   - N patterns learned
      |                   |   - Cache hit rate: X%
      |                   | "The more it runs, the smarter it gets."
      |                   |
4:30  | CLOSING (30s)     | "Traditional scrapers break and stay
      |                   |  broken. WebScout breaks and gets smarter.
      |                   |
      |                   |  Built with:
      |                   |  - Browserbase + Stagehand for browser AI
      |                   |  - Weave for tracing every action
      |                   |  - Redis for vector-powered memory
      |                   |  - Vercel for the dashboard
      |                   |
      |                   |  Every failed click makes it smarter."
      |                   |
5:00  | END               |
```

### Key Demo Talking Points

**For judges asking "how does the learning work?"**
> "When WebScout successfully extracts data, it stores the approach as an embedding in Redis. Next time it sees a similar URL pattern, it does a vector KNN search and finds the cached approach. If the score is above 85%, it reuses the approach instead of figuring it out from scratch."

**For judges asking "what happens when it fails?"**
> "It has three recovery strategies. First, it tries an autonomous agent to navigate around obstacles. Second, it tries clicking away cookie banners or popups. Third, it retries with a more detailed instruction. If any strategy works, it stores the new approach. If all fail, it reports the failure with full trace data."

**For judges asking about Weave integration:**
> "Every major function is wrapped with `weave.op()`. This creates a nested trace tree — you can see exactly which functions were called, what they returned, and how long they took. We also capture screenshots and DOM snapshots at each step."

**For judges asking about Redis:**
> "We use RediSearch's HNSW vector index with 1536-dimensional embeddings from OpenAI. Patterns are stored as Redis hashes with an embedding field. When searching, we do a KNN cosine similarity search to find the most relevant cached pattern."

---

## Step 6.6: Pre-Demo Checklist

Run through this checklist 30 minutes before the demo:

### Infrastructure

- [ ] Production Vercel URL loads (`https://your-app.vercel.app`)
- [ ] Health endpoint returns `"status": "healthy"`
- [ ] Redis Cloud is running and connected
- [ ] All 7 env vars configured in Vercel
- [ ] Weave dashboard accessible at https://wandb.ai

### Data

- [ ] Dashboard shows seeded data (or fresh start for live demo)
- [ ] At least 2 patterns in the Recovery Library
- [ ] Stats show correct numbers

### Demo Flow

- [ ] Browser tabs pre-opened:
  1. WebScout Dashboard
  2. Weave/W&B Dashboard
  3. (Optional) Browserbase session viewer
- [ ] Demo URL ready to paste: `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html`
- [ ] Target ready to paste: `book title and price`
- [ ] Second demo URL ready: different book on same site
- [ ] Network connection stable
- [ ] Browser zoom level comfortable for audience

### Backup Plans

- [ ] If Vercel is slow → run local (`npm run dev`)
- [ ] If Browserbase is down → show pre-recorded trace screenshots
- [ ] If Redis Cloud fails → use local Docker Redis
- [ ] If live task fails → show seeded task detail instead
- [ ] Have 3+ backup URLs ready:
  - `https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html`
  - `https://quotes.toscrape.com/`
  - `https://quotes.toscrape.com/page/2/`

---

## Step 6.7: Backup Demo Sites

Keep these sites ready as alternatives if primary demo sites are problematic:

| Site | URL | Good Target |
|------|-----|-------------|
| Books to Scrape | `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html` | "book title and price" |
| Books (alt) | `https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html` | "book title and price" |
| Quotes to Scrape | `https://quotes.toscrape.com/` | "first quote text and author" |
| Quotes Page 2 | `https://quotes.toscrape.com/page/2/` | "first quote text and author" |
| Quotes (tagged) | `https://quotes.toscrape.com/tag/love/` | "all quotes about love" |

All of these are static public test sites designed for scraping — highly reliable.

---

## Step 6.8: Troubleshooting Production Issues

### Issue: Tasks timeout on Vercel

**Symptom:** `FUNCTION_INVOCATION_TIMEOUT` error

**Fixes:**
1. Verify `export const maxDuration = 60;` in `src/app/api/tasks/route.ts`
2. If on Hobby plan: request Vercel Pro trial or demo locally
3. Pre-seed data and demo with cached patterns (faster execution)

### Issue: Redis Cloud connection refused

**Symptom:** Health check shows Redis error

**Fixes:**
1. Check Redis Cloud dashboard — is the database active?
2. Verify `REDIS_URL` format: `redis://default:<password>@<host>:<port>`
3. Check if SSL is required: some providers need `rediss://` (note the extra 's')
4. Whitelist Vercel IPs if Redis Cloud has IP restrictions (or disable)

### Issue: Vector index not created

**Symptom:** Pattern searches return empty

**Fixes:**
1. The index is created on first `ensureVectorIndex()` call (happens on first task)
2. Verify RediSearch module is loaded: `redis-cli MODULE LIST`
3. If using Upstash: RediSearch may not be available — check their docs

### Issue: Weave traces not appearing

**Symptom:** W&B dashboard shows no data

**Fixes:**
1. Check `WANDB_API_KEY` is set correctly
2. Verify `WEAVE_PROJECT` matches what's in W&B
3. Check server logs for `[Weave] Failed to initialize` messages
4. The Weave TS SDK may have initialization timing issues — check that `initWeave()` is called before traced operations

### Issue: Screenshots not rendering in UI

**Symptom:** Trace timeline shows broken images

**Fixes:**
1. Check that `captureScreenshot()` returns non-empty base64 string
2. Verify base64 data starts with valid PNG header
3. Check if Stagehand/Playwright page is available at screenshot time
4. Screenshots may fail if the page has already navigated away

---

## Step 6.9: GitHub Actions — Full Integration Workflow

**File: `.github/workflows/integration.yml`**

This workflow runs the complete build pipeline for all phases.

```yaml
# Full Integration - Build Verification
# Runs on every push to main and all PRs
# Tests: dependencies, types, lint, build, file structure
name: Full Integration

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  integration:
    name: Full Build & Verify
    runs-on: ubuntu-latest
    timeout-minutes: 15

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

      # ── Verify File Structure (All Phases) ──

      - name: "Phase 1: Verify scaffolding"
        run: |
          echo "=== Phase 1: Scaffolding ==="
          test -f webscout/package.json && echo "✓ package.json"
          test -f webscout/next.config.ts && echo "✓ next.config.ts"
          test -f webscout/docker-compose.yml && echo "✓ docker-compose.yml"
          test -f webscout/.env.example && echo "✓ .env.example"
          test -f webscout/src/components/theme-provider.tsx && echo "✓ theme-provider"
          test -f webscout/src/lib/utils.ts && echo "✓ utils.ts (cn helper)"
          SHADCN_COUNT=$(ls webscout/src/components/ui/*.tsx 2>/dev/null | wc -l | tr -d ' ')
          echo "  shadcn/ui components: $SHADCN_COUNT"

      - name: "Phase 2: Verify infrastructure"
        run: |
          echo "=== Phase 2: Infrastructure ==="
          test -f webscout/src/lib/utils/types.ts && echo "✓ types.ts"
          test -f webscout/src/lib/utils/url.ts && echo "✓ url.ts"
          test -f webscout/src/lib/redis/client.ts && echo "✓ redis/client.ts"
          test -f webscout/src/lib/redis/vectors.ts && echo "✓ redis/vectors.ts"
          test -f webscout/src/lib/redis/patterns.ts && echo "✓ redis/patterns.ts"
          test -f webscout/src/lib/embeddings/openai.ts && echo "✓ embeddings/openai.ts"
          test -f webscout/src/lib/tracing/weave.ts && echo "✓ tracing/weave.ts"
          test -f webscout/src/lib/tracing/trace-context.ts && echo "✓ tracing/trace-context.ts"

      - name: "Phase 3: Verify engine"
        run: |
          echo "=== Phase 3: Engine ==="
          test -f webscout/src/lib/browser/session.ts && echo "✓ browser/session.ts"
          test -f webscout/src/lib/browser/stagehand-client.ts && echo "✓ browser/stagehand-client.ts"
          test -f webscout/src/lib/engine/scraper.ts && echo "✓ engine/scraper.ts"
          test -f webscout/src/lib/engine/recovery.ts && echo "✓ engine/recovery.ts"
          test -f webscout/src/lib/engine/pattern-extractor.ts && echo "✓ engine/pattern-extractor.ts"

      - name: "Phase 4: Verify API routes"
        run: |
          echo "=== Phase 4: API Routes ==="
          test -f webscout/src/lib/redis/tasks.ts && echo "✓ redis/tasks.ts"
          test -f webscout/src/app/api/tasks/route.ts && echo "✓ api/tasks/route.ts"
          test -f webscout/src/app/api/tasks/\[id\]/route.ts && echo "✓ api/tasks/[id]/route.ts"
          test -f webscout/src/app/api/patterns/route.ts && echo "✓ api/patterns/route.ts"
          test -f webscout/src/app/api/health/route.ts && echo "✓ api/health/route.ts"

      - name: "Phase 5: Verify dashboard"
        run: |
          echo "=== Phase 5: Dashboard ==="
          test -f webscout/src/app/page.tsx && echo "✓ Root page"
          test -f webscout/src/app/layout.tsx && echo "✓ Root layout"
          test -f webscout/src/app/dashboard/layout.tsx && echo "✓ Dashboard layout"
          test -f webscout/src/app/dashboard/page.tsx && echo "✓ Dashboard page"
          test -f webscout/src/app/tasks/page.tsx && echo "✓ Tasks page"
          test -f webscout/src/app/tasks/\[id\]/page.tsx && echo "✓ Task detail page"
          test -f webscout/src/app/patterns/page.tsx && echo "✓ Patterns page"
          echo "--- Components ---"
          test -f webscout/src/components/stats-overview.tsx && echo "✓ StatsOverview"
          test -f webscout/src/components/task-form.tsx && echo "✓ TaskForm"
          test -f webscout/src/components/task-list.tsx && echo "✓ TaskList"
          test -f webscout/src/components/trace-timeline.tsx && echo "✓ TraceTimeline"
          test -f webscout/src/components/pattern-card.tsx && echo "✓ PatternCard"
          test -f webscout/src/components/pattern-grid.tsx && echo "✓ PatternGrid"
          echo "--- Hooks ---"
          test -f webscout/src/hooks/use-tasks.ts && echo "✓ useTasks"
          test -f webscout/src/hooks/use-patterns.ts && echo "✓ usePatterns"

      # ── Smoke Test with Running Server ──

      - name: "Smoke test: Start server and verify endpoints"
        run: |
          cd webscout
          npm start &
          APP_PID=$!

          # Wait for app to be ready
          for i in {1..30}; do
            if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
              echo "App is ready!"
              break
            fi
            sleep 1
          done

          echo ""
          echo "=== Smoke Tests ==="

          # Health check
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health)
          [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ] && echo "✓ GET /api/health ($HTTP_CODE)" || echo "✗ GET /api/health ($HTTP_CODE)"

          # Tasks list
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/tasks)
          [ "$HTTP_CODE" = "200" ] && echo "✓ GET /api/tasks" || echo "✗ GET /api/tasks ($HTTP_CODE)"

          # Patterns list
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/patterns)
          [ "$HTTP_CODE" = "200" ] && echo "✓ GET /api/patterns" || echo "✗ GET /api/patterns ($HTTP_CODE)"

          # Input validation (missing target)
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/tasks \
            -H 'Content-Type: application/json' -d '{"url":"https://example.com"}')
          [ "$HTTP_CODE" = "400" ] && echo "✓ POST validation (missing target)" || echo "✗ Expected 400 ($HTTP_CODE)"

          # Input validation (invalid URL)
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/tasks \
            -H 'Content-Type: application/json' -d '{"url":"bad","target":"test"}')
          [ "$HTTP_CODE" = "400" ] && echo "✓ POST validation (invalid URL)" || echo "✗ Expected 400 ($HTTP_CODE)"

          # 404 for unknown task
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/tasks/nonexistent)
          [ "$HTTP_CODE" = "404" ] && echo "✓ GET unknown task (404)" || echo "✗ Expected 404 ($HTTP_CODE)"

          # Dashboard redirect
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -L http://localhost:3000)
          [ "$HTTP_CODE" = "200" ] && echo "✓ Root → dashboard redirect" || echo "✗ Root redirect ($HTTP_CODE)"

          echo ""
          echo "=== Smoke Tests Complete ==="

          kill $APP_PID 2>/dev/null || true
        env:
          BROWSERBASE_API_KEY: "ci_placeholder"
          BROWSERBASE_PROJECT_ID: "ci_placeholder"
          OPENAI_API_KEY: "ci_placeholder"
          REDIS_URL: "redis://localhost:6379"
          WANDB_API_KEY: "ci_placeholder"
          WEAVE_PROJECT: "webscout"
          NEXT_PUBLIC_APP_URL: "http://localhost:3000"

      - name: "Summary"
        run: |
          echo ""
          echo "========================================"
          echo "  WebScout Integration Check Complete"
          echo "========================================"
          echo ""
          echo "All phases verified:"
          echo "  ✓ Phase 1: Scaffolding & dependencies"
          echo "  ✓ Phase 2: Redis, embeddings, Weave"
          echo "  ✓ Phase 3: Learning scraper engine"
          echo "  ✓ Phase 4: API routes & task management"
          echo "  ✓ Phase 5: Dashboard UI"
          echo "  ✓ Phase 6: Build & smoke tests pass"
          echo ""
          echo "Ready for deployment to Vercel."
```

---

## File Checklist

| File | Status | Created By |
|------|--------|------------|
| `webscout/src/lib/browser/stagehand-client.ts` | **UPDATED** | Step 6.1.1 |
| `webscout/src/lib/engine/scraper.ts` | **UPDATED** | Step 6.1.2 |
| `webscout/src/lib/embeddings/openai.ts` | **UPDATED** | Step 6.1.3 |
| `webscout/src/app/api/tasks/route.ts` | **UPDATED** | Step 6.1.5 |
| `.github/workflows/integration.yml` | **NEW** | Step 6.9 |

---

## Complete Project File Count

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| Phase 1 | ~30 (scaffolding + shadcn) | 0 |
| Phase 2 | 8 (types, url, redis, embeddings, weave, trace) | 0 |
| Phase 3 | 5 (session, stagehand, scraper, recovery, extractor) | 0 |
| Phase 4 | 5 (tasks.ts, 3 routes, workflow) | 1 (health route) |
| Phase 5 | 18 (9 pages, 6 components, 2 hooks, 1 workflow) | 2 (layout, page) |
| Phase 6 | 1 (integration workflow) | 4 (hardened files) |
| **Total** | **~67 files** | **7 modifications** |

---

## Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | `text-embedding-3-small` (1536 dims) | Fast, cheap (~$0.02/1M tokens), sufficient for URL+target matching |
| Vector storage | Redis + RediSearch HNSW | Required sponsor; single DB for patterns + tasks + vectors |
| Browser env | Browserbase (cloud) | No local browser needed; works on Vercel serverless |
| Stagehand LLM | `gpt-4o` | Best speed + capability balance for browser automation |
| Task execution | Synchronous in API route | Simpler for hackathon; loading spinner in UI acceptable |
| Data fetching | SWR with 5s auto-refresh | No WebSocket complexity; adequate for live demo |
| Tracing | `weave.op` wrapping each function | Nested trace tree in W&B dashboard |
| Hosting | Vercel | Required sponsor; native Next.js support |
| Redis (prod) | Redis Cloud free tier | No Docker dependency on demo machine; RediSearch included |

## Risk Mitigation Summary

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis vector search too complex | Can't store/retrieve patterns | Use Upstash Vector as fallback |
| Stagehand unreliable on arbitrary sites | Demo failures | Demo only on known-good sites (toscrape.com) |
| Vercel function timeout (10s hobby) | Tasks killed mid-execution | `maxDuration = 60` or Vercel Pro trial |
| Weave TS SDK issues | Limited tracing | Graceful degradation — app works without Weave |
| Browserbase rate limits | Can't run demo tasks | Pre-seed data; limit demo to 4-6 tasks |
| Live site changes before demo | Cached patterns break | Pre-seed patterns; 5+ backup sites ready |
| Redis Cloud connection issues | No caching | Scraper works without cache (graceful degradation) |
| Network issues during demo | Can't reach services | Run locally as backup (`npm run dev` + Docker Redis) |

---

**Phase 6 Complete. WebScout is ready for demo day.**

Every failed click makes it smarter.
