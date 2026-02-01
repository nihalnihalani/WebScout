<div align="center">

# WebScout

### Every failed click makes it smarter.

A self-improving browser automation agent that learns from every success and failure, getting measurably faster and more accurate over time.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
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

WebScout is a **self-improving browser automation agent** that treats every task as a learning opportunity:

- **Vector-cached patterns** from past successes eliminate redundant AI calls
- **Multi-strategy AI recovery** handles failures without human intervention
- **Measurable improvement** over time, backed by quantitative metrics
- **Full observability** into every decision via Weave tracing

The result: an agent that starts competent and becomes expert, with the data to prove it.

---

## How It Works — 5-Stage Learning Pipeline

```
   1. SEARCH          2. TRY CACHE         3. FRESH EXTRACT
   ┌───────────┐      ┌───────────┐        ┌───────────┐
   │  Vector   │─────>│  Cached   │──miss─>│  Direct   │
   │   KNN     │      │  Pattern  │        │  Extract  │
   │  Search   │      │  (>85%)   │        │ Stagehand │
   └───────────┘      └─────┬─────┘        └─────┬─────┘
                            │ hit                 │ fail
                            ▼                     ▼
   5. OBSERVE          4. LEARN            3b. RECOVERY
   ┌───────────┐      ┌───────────┐        ┌───────────┐
   │  Weave    │<─────│  Store    │<───────│  Multi-   │
   │  Trace    │      │  Vector   │        │ Strategy  │
   │  Every    │      │ Embedding │        │    AI     │
   │  Step     │      └───────────┘        └───────────┘
   └───────────┘
```

| Stage | What Happens |
|-------|-------------|
| **1. Vector Search** | KNN search against 1536-dim HNSW index in Redis for cached patterns |
| **2. Cached Pattern** | High-confidence match (>85% similarity)? Reuse the extraction approach instantly |
| **3. Fresh Extraction** | No cache hit — Browserbase + Stagehand AI extracts from the live page |
| **3b. Recovery** | If extraction fails, deploy 4 recovery strategies in sequence |
| **4. Learn** | Store successful patterns as vector embeddings for future reuse |
| **5. Observe** | Every operation traced with Weave for full observability |

### Recovery Strategies

When extraction fails, WebScout deploys up to four strategies:

| Strategy | Approach | Powered By |
|----------|----------|-----------|
| **A. AI Agent** | Autonomous browsing to navigate complex pages | GPT-4o via Stagehand |
| **B. Blocker Removal** | Dismiss popups, cookie banners, overlays | Stagehand actions |
| **C. Refined Extraction** | Enhanced instructions with additional context | GPT-4o |
| **D. Gemini Analysis** | Full page analysis with a different model | Google Gemini 2.0-flash |

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              WebScout Dashboard          │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐│
                    │  │ Live View│ │Evaluation│ │ Teaching ││
                    │  └──────────┘ └──────────┘ └──────────┘│
                    └────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────▼────────────────────┐
                    │            Learning Engine              │
                    │                                         │
                    │  Vector Search → Extract → Recovery     │
                    │       ↑              ↓            ↓     │
                    │       └────── Pattern Store ◄─────┘     │
                    └──────┬─────────┬──────────┬────────────┘
                           │         │          │
                    ┌──────▼──┐ ┌───▼────┐ ┌──▼──────────┐
                    │  Redis   │ │Browser-│ │   Weave     │
                    │ +Search  │ │  base  │ │ (Tracing)   │
                    │ (Cache)  │ │+Stage- │ │             │
                    │          │ │ hand   │ │             │
                    └──────────┘ └────────┘ └─────────────┘
```

---

## Quantitative Proof of Improvement

WebScout doesn't just claim to improve — it **proves** it with data:

| Metric | Early Tasks | Recent Tasks | Improvement |
|--------|------------|--------------|-------------|
| **Success Rate** | 86% | 100% | +17% |
| **Extraction Speed** | 10.1s | 2.7s | **3.7x faster** |
| **Cache Hit Rate** | 14% | 83% | **+69pp** |
| **Recovery Needed** | 86% | 17% | **-81%** |

These metrics emerge naturally from the learning loop as the vector cache fills with successful patterns. Every operation is traced in Weave.

---

## Features

### Core Intelligence
- **Self-Improving Learning Loop** — Every task makes the system smarter through vector-cached patterns
- **Multi-Strategy Recovery** — Four fallback strategies including cross-model analysis with Gemini
- **Pattern Fitness Scoring** — Wilson Score + time decay ranks patterns by reliability
- **Adaptive Confidence Threshold** — Failures penalize 4x more than successes reward

### Dashboard
- **Live Browser View** — Watch the agent work in real-time via Browserbase session viewer
- **Evaluation Dashboard** — Quantitative self-improvement proof with scoring
- **Learning Curve Chart** — Speed and accuracy improvement visualized over time
- **Learning Timeline** — Step-by-step trace of the agent's decision process
- **Pattern Library** — Browse all learned extraction patterns with fitness scores

### Developer Experience
- **Teaching Mode** — Manually teach extraction patterns for specific sites
- **Deep Weave Integration** — 12+ traced operations with custom summarize callbacks
- **Health Monitoring** — Real-time status checks for Redis, Browserbase, Weave, and AI models
- **Demo Data Seeding** — One-click demo data population for showcasing

---

## Sponsor Integrations

| Sponsor | Integration | Depth |
|---------|------------|-------|
| **Weave (W&B)** | Full observability & tracing | 12+ traced functions, custom metrics, evaluation datasets, retrospective feedback |
| **Browserbase** | Cloud browser automation | Every task runs in a managed cloud browser with Stagehand AI extraction |
| **Redis** | Vector cache + pattern storage | RediSearch HNSW vector search, sorted sets for task history, hash storage for metadata |
| **Google Gemini** | Recovery fallback AI | Gemini 2.0-flash provides a second model's perspective on difficult pages |
| **Vercel** | Production deployment | Next.js 16 on Vercel Edge for dashboard and API |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **Browser Automation** | Browserbase SDK + Stagehand v3 |
| **AI Models** | OpenAI GPT-4o, text-embedding-3-small, Google Gemini 2.0-flash |
| **Storage & Search** | Redis v5 + RediSearch (HNSW vector similarity) |
| **Observability** | Weave (Weights & Biases) |
| **Charts** | Recharts |
| **Deployment** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Redis Stack (with RediSearch module)
- API keys for Browserbase, OpenAI, W&B, and Google AI

### Installation

```bash
# Clone the repository
git clone https://github.com/nihalnihalani/weave.git
cd weave/webscout

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see below)

# Start Redis Stack
docker compose up -d   # or: brew install redis-stack && redis-stack-server &

# Run the development server
npm run dev

# Seed demo data (optional)
curl -X POST http://localhost:3000/api/demo/seed
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Environment Variables

```env
BROWSERBASE_API_KEY=       # browserbase.com/settings
BROWSERBASE_PROJECT_ID=    # Browserbase dashboard
OPENAI_API_KEY=            # platform.openai.com/api-keys
REDIS_URL=                 # Default: redis://localhost:6379
WANDB_API_KEY=             # wandb.ai/authorize
WEAVE_PROJECT=             # Default: webscout
GOOGLE_AI_API_KEY=         # aistudio.google.com/apikey
```

---

## Project Structure

```
.
├── webscout/                    # Main Next.js application
│   ├── src/
│   │   ├── app/                 # Pages + API routes
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── live/            # Real-time browser view
│   │   │   ├── tasks/           # Task management
│   │   │   ├── patterns/        # Pattern library
│   │   │   ├── evaluation/      # Self-improvement metrics
│   │   │   ├── teach/           # Manual teaching mode
│   │   │   └── api/             # Backend API
│   │   ├── lib/
│   │   │   ├── engine/          # Core learning engine
│   │   │   │   ├── scraper.ts   # THE learning loop
│   │   │   │   ├── recovery.ts  # Multi-strategy recovery
│   │   │   │   └── pattern-fitness.ts
│   │   │   ├── browser/         # Browserbase + Stagehand
│   │   │   ├── redis/           # Vector search + storage
│   │   │   ├── ai/              # Gemini integration
│   │   │   ├── embeddings/      # OpenAI embeddings
│   │   │   └── tracing/         # Weave integration
│   │   └── components/          # React UI components
│   ├── docker-compose.yml       # Redis Stack
│   └── package.json
└── demo-video/                  # Remotion demo video
    ├── src/scenes/              # 8 animated scenes
    └── out/webscout-demo.mp4    # Rendered 40s demo
```

---

<div align="center">

**WebScout** — Built for [WeaveHacks 3](https://lu.ma/weavehacks3)

Powered by Weave, Browserbase, Redis, Gemini, and Vercel

</div>
