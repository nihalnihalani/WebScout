# Phase 1: Project Scaffolding & Environment Setup

## Phase Overview

**Goal:** Set up a fully functional Next.js project with all dependencies, dark theme, Redis, and CI/CD — ready for development.

**Produces:**
- Running Next.js app at `localhost:3000`
- All npm dependencies installed
- shadcn/ui components with dark theme
- Redis Stack running via Docker
- Health check API endpoint
- GitHub Actions CI workflow

**Prerequisites:**
- Node.js 18+ (recommended 20 LTS)
- npm 9+
- Docker Desktop installed and running
- API keys: Browserbase, OpenAI, Weights & Biases (sign up instructions below)

---

## Step 1.1: Initialize Next.js Project

```bash
npx create-next-app@latest webscout --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

If prompted for additional options:
- React Compiler: **No**
- Turbopack: **No** (optional, can say Yes)

**Files created by this command:**
```
webscout/
├── src/app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
├── .eslintrc.json
├── .gitignore
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

```bash
cd webscout
```

---

## Step 1.2: Install All Dependencies

### Core Dependencies

```bash
npm install @browserbasehq/stagehand @browserbasehq/sdk zod openai redis swr lucide-react clsx tailwind-merge next-themes
```

### Dev Dependencies

```bash
npm install -D @types/node
```

### Package Reference Table

| Package | Purpose | Why Needed |
|---------|---------|------------|
| `@browserbasehq/stagehand` | AI-powered browser automation (act, extract, agent) | Core: executes web scraping tasks via natural language |
| `@browserbasehq/sdk` | Browserbase cloud browser session management | Core: creates/manages cloud browser sessions |
| `zod` | TypeScript-first schema validation | Required by Stagehand's extract() for typed data extraction |
| `openai` | OpenAI API client | Embeddings (text-embedding-3-small) + Stagehand LLM backbone |
| `redis` | Node.js Redis client (node-redis v4+) | Core: stores learned patterns with RediSearch vector index |
| `swr` | React data fetching with auto-refresh | Dashboard: polls API endpoints every 5 seconds |
| `lucide-react` | Icon library (200+ icons) | Dashboard: status icons, navigation icons |
| `clsx` | Conditional className utility | Used by shadcn/ui's `cn()` helper |
| `tailwind-merge` | Merges Tailwind classes without conflicts | Used by shadcn/ui's `cn()` helper |
| `next-themes` | Theme management for Next.js | Dark/light mode switching |
| `@types/node` | Node.js TypeScript definitions | Type safety for Node.js APIs (Buffer, crypto, etc.) |

---

## Step 1.3: Set Up shadcn/ui

### Initialize shadcn

```bash
npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

### Add UI Components

```bash
npx shadcn@latest add button card badge input textarea table tabs separator skeleton dropdown-menu
```

This creates files in `src/components/ui/`:
- `badge.tsx`, `button.tsx`, `card.tsx`, `dropdown-menu.tsx`
- `input.tsx`, `separator.tsx`, `skeleton.tsx`
- `table.tsx`, `tabs.tsx`, `textarea.tsx`

And creates `src/lib/utils.ts` with the `cn()` helper:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## Step 1.4: Theme Provider Component

**File: `src/components/theme-provider.tsx`**

```tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

---

## Step 1.5: Root Layout with Dark Theme

**File: `src/app/layout.tsx`** (replace the generated one)

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Step 1.6: Environment Variables

### Get Your API Keys

| Service | Sign Up URL | What You Need |
|---------|------------|---------------|
| **Browserbase** | https://www.browserbase.com/ | API Key + Project ID from dashboard |
| **OpenAI** | https://platform.openai.com/api-keys | API key (for embeddings + Stagehand) |
| **Redis** (local) | Docker (see Step 1.7) | `redis://localhost:6379` |
| **Redis** (cloud) | https://redis.io/try-free | Connection URL from Redis Cloud |
| **Weights & Biases** | https://wandb.ai/authorize | API key for Weave tracing |

### Create `.env.example`

**File: `.env.example`**

```env
# ============================================
# WebScout Environment Variables
# ============================================

# --- Browserbase (cloud browser automation) ---
# Get from: https://www.browserbase.com/settings
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

# --- OpenAI (embeddings + Stagehand LLM) ---
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# --- Redis (pattern storage + vector search) ---
# Local Docker: redis://localhost:6379
# Redis Cloud: redis://default:password@host:port
REDIS_URL=redis://localhost:6379

# --- Weave / Weights & Biases (tracing) ---
# Get from: https://wandb.ai/authorize
WANDB_API_KEY=your_wandb_api_key_here
WEAVE_PROJECT=webscout

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Create `.env.local`

```bash
cp .env.example .env.local
# Then edit .env.local with your real API keys
```

---

## Step 1.7: Docker Compose for Redis Stack

**File: `docker-compose.yml`**

```yaml
version: "3.8"

services:
  redis:
    image: redis/redis-stack:latest
    container_name: webscout-redis
    ports:
      - "6379:6379"   # Redis server
      - "8001:8001"   # RedisInsight web UI
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis-data:
```

**Start Redis:**

```bash
docker compose up -d
```

**Verify:**
```bash
docker compose ps
# Should show webscout-redis as "Up (healthy)"

docker exec webscout-redis redis-cli ping
# Should print: PONG
```

RedisInsight UI is available at http://localhost:8001

> **Production note:** For Vercel deployment, use **Redis Cloud** (free tier at https://redis.io/try-free) or **Upstash Redis** instead of Docker. The code connects via `REDIS_URL`, making it environment-agnostic.

---

## Step 1.8: Next.js Configuration

**File: `next.config.ts`** (replace the generated one)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use Node.js APIs that can't be bundled client-side
  serverExternalPackages: [
    "redis",
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
    "weave",
  ],
};

export default nextConfig;
```

### Update `.gitignore` — add these lines:

```
# Environment variables (secrets)
.env.local
.env*.local

# Docker volumes
redis-data/
```

---

## Step 1.9: Health Check Route

**File: `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "redis";

export async function GET() {
  const startTime = Date.now();

  const services: Record<string, { status: string; message: string; latency_ms?: number }> = {};
  const configuration: Record<string, string> = {};

  // --- Check Redis ---
  try {
    const redisStart = Date.now();
    const client = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
    await client.connect();
    await client.ping();
    await client.disconnect();
    services.redis = {
      status: "ok",
      message: "Redis is connected and responding",
      latency_ms: Date.now() - redisStart,
    };
  } catch (e) {
    services.redis = {
      status: "error",
      message: `Redis connection failed: ${(e as Error).message}`,
    };
  }

  // --- Check API key configuration ---
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

  // --- Overall status ---
  const allServicesOk = Object.values(services).every((s) => s.status === "ok");
  const allKeysConfigured = Object.values(configuration).every((v) => v === "configured");
  const overallStatus = allServicesOk && allKeysConfigured ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      services,
      configuration,
      version: "0.1.0",
    },
    { status: overallStatus === "healthy" ? 200 : 503 }
  );
}
```

---

## Step 1.10: Testing & Debugging

### Verification Steps

```bash
# 1. Start Redis
docker compose up -d

# 2. Start dev server
npm run dev

# 3. Test health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool

# 4. Type checking
npx tsc --noEmit

# 5. Linting
npm run lint

# 6. Production build
npm run build
```

### Expected Health Response

```json
{
  "status": "healthy",
  "services": {
    "redis": { "status": "ok", "message": "Redis is connected and responding", "latency_ms": 3 }
  },
  "configuration": {
    "browserbase_api_key": "configured",
    "openai_api_key": "configured",
    "redis_url": "configured",
    "wandb_api_key": "configured",
    "weave_project": "configured"
  }
}
```

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED 127.0.0.1:6379` | Docker not running or Redis not started | Run `docker compose up -d` |
| `Module not found: Can't resolve 'net'` | Missing `serverExternalPackages` in next.config.ts | Add redis, stagehand, sdk, weave to `serverExternalPackages` |
| `Module not found: '@browserbasehq/stagehand'` | Dependencies not installed | Run `npm install` |
| Tailwind classes not applying | Missing Tailwind directives in globals.css | Ensure `@tailwind base/components/utilities` are present |
| Dark mode flickers on load | Missing `suppressHydrationWarning` | Add to `<html>` tag in layout.tsx |
| `Port 6379 already in use` | Another Redis instance running | Run `lsof -i :6379` and stop the other process |

### Debug Checklist

- [ ] `node -v` prints v18+ or v20+
- [ ] `docker info` runs without errors
- [ ] `docker compose ps` shows webscout-redis as Up (healthy)
- [ ] `npm run dev` starts on http://localhost:3000
- [ ] Browser shows dark background
- [ ] `curl http://localhost:3000/api/health` returns JSON with status "healthy"
- [ ] `npx tsc --noEmit` produces no errors
- [ ] `npm run lint` shows no errors
- [ ] `npm run build` succeeds
- [ ] `ls src/components/ui/` lists 10 component files
- [ ] `.env.local` exists with real API keys

---

## Step 1.11: GitHub Workflow

**File: `.github/workflows/phase-1-build.yml`**

```yaml
# Phase 1 - Build Verification
# Verifies: dependencies install, types check, lint passes, build succeeds
name: Phase 1 - Build Verification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build & Verify
    runs-on: ubuntu-latest
    timeout-minutes: 10

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
```

**Why placeholder env vars in CI:** The build step needs these to exist (some code references `process.env.*` at build time). They're never used for actual API calls — this is a build-only check.

---

## File Checklist

| File | Created By |
|------|-----------|
| `webscout/package.json` | create-next-app + npm install |
| `webscout/package-lock.json` | npm |
| `webscout/next.config.ts` | Modified (Step 1.8) |
| `webscout/tsconfig.json` | create-next-app |
| `webscout/tailwind.config.ts` | create-next-app + shadcn |
| `webscout/.env.example` | Manual (Step 1.6) |
| `webscout/.env.local` | Manual (Step 1.6) |
| `webscout/docker-compose.yml` | Manual (Step 1.7) |
| `webscout/components.json` | shadcn init |
| `webscout/src/app/layout.tsx` | Replaced (Step 1.5) |
| `webscout/src/app/globals.css` | create-next-app + shadcn |
| `webscout/src/app/page.tsx` | create-next-app |
| `webscout/src/app/api/health/route.ts` | Manual (Step 1.9) |
| `webscout/src/components/theme-provider.tsx` | Manual (Step 1.4) |
| `webscout/src/components/ui/*.tsx` | shadcn add (10 files) |
| `webscout/src/lib/utils.ts` | shadcn init |
| `.github/workflows/phase-1-build.yml` | Manual (Step 1.11) |

**Total: ~30 files**

---

**Phase 1 Complete.** You now have a fully scaffolded Next.js project with dark theme, Redis, all dependencies, and CI/CD. **Next: Phase 2 — Core Infrastructure.**
