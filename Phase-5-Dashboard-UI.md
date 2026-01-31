# Phase 5: Dashboard UI

## Phase Overview

**Goal:** Build the Next.js dashboard for visual impact during the demo. Show the learning process, failure recovery library, real-time task execution, and trace timelines with screenshots.

**Dependencies:** Phase 4 complete (API routes, task storage)

**Produces:**
- Root layout with dark theme and sidebar navigation
- Dashboard home page with stats, task form, and recent tasks
- Task list page with color-coded status badges
- Task detail page with trace timeline and screenshot viewer
- Patterns page ("Failure Recovery Library") with card grid
- SWR hooks for auto-refreshing data every 5 seconds
- All reusable UI components

---

## Architecture: Dashboard Pages & Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Pages                        Components (shared)                 │
│  ──────                       ─────────────────                   │
│  / (redirect → /dashboard)    <StatsOverview />                   │
│                                ├── Stat cards (total, patterns,   │
│  /dashboard                    │   cache rate, recovery rate)     │
│  ├── <StatsOverview />         │                                  │
│  ├── <TaskForm />             <TaskForm />                        │
│  └── <TaskList />              ├── URL input                      │
│                                ├── Target textarea                │
│  /tasks                        └── Submit button + loading        │
│  └── <TaskList />                                                 │
│                               <TaskList />                        │
│  /tasks/[id]                   ├── Task rows with status badges   │
│  ├── Task header info          └── Link to task detail            │
│  ├── Extracted data view                                          │
│  └── <TraceTimeline />        <TraceTimeline />  ← DEMO STAR     │
│                                ├── Vertical timeline with dots    │
│  /patterns                     ├── Step cards with icons          │
│  └── <PatternGrid />          ├── Screenshot thumbnails           │
│      └── <PatternCard />×N    └── Expandable screenshot modal     │
│                                                                   │
│  Hooks                        <PatternCard />                     │
│  ──────                        ├── URL pattern (monospace)        │
│  useTasks()  → GET /api/tasks  ├── Target description             │
│  useTask(id) → GET /api/tasks/ ├── Working selector               │
│  usePatterns() → GET /api/pat  ├── Approach badge                 │
│                                └── Success count                   │
│                                                                   │
│  Layout                       <PatternGrid />                     │
│  ──────                        └── 3-column responsive grid       │
│  <DashboardLayout />                                              │
│  ├── Sidebar with nav links                                       │
│  ├── WebScout logo                                                │
│  └── Main content area                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Color Coding System

The dashboard uses consistent color coding for task statuses:

| Status | Color | Badge Style | Icon |
|--------|-------|-------------|------|
| **Success** (fresh) | Emerald/Green | `bg-emerald-500/20 text-emerald-400` | `CheckCircle` |
| **Cached** (pattern hit) | Blue | `bg-blue-500/20 text-blue-400` | `Zap` |
| **Recovered** (failed → fixed) | Amber/Orange | `bg-amber-500/20 text-amber-400` | `RefreshCw` |
| **Failed** (all strategies) | Red | `bg-red-500/20 text-red-400` | `XCircle` |
| **Pending/Running** | Zinc/Gray | `bg-zinc-500/20 text-zinc-400` | `Clock` |

---

## Step 5.1: Root Layout with Dark Theme

**File: `src/app/layout.tsx`** (replace existing)

The root layout sets up the dark theme, Inter font, and ThemeProvider for the entire application.

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

> **Note:** The `ThemeProvider` was created in Phase 1 (Step 1.4). If you skipped that, create `src/components/theme-provider.tsx` now.

---

## Step 5.2: Root Page (Redirect to Dashboard)

**File: `src/app/page.tsx`** (replace existing)

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

---

## Step 5.3: Dashboard Layout with Sidebar

**File: `src/app/dashboard/layout.tsx`**

The sidebar navigation shared across Dashboard, Tasks, and Patterns pages.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Brain,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950">
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
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sponsor Footer */}
        <div className="mt-auto pt-6 border-t border-zinc-800">
          <div className="space-y-1 text-xs text-zinc-600">
            <p>Powered by</p>
            <p className="text-zinc-500">Browserbase + Stagehand</p>
            <p className="text-zinc-500">Weave (W&B)</p>
            <p className="text-zinc-500">Redis + RediSearch</p>
            <p className="text-zinc-500">Vercel</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
```

---

## Step 5.4: SWR Data Fetching Hooks

### Tasks Hook

**File: `src/hooks/use-tasks.ts`**

```typescript
import useSWR from "swr";
import type { TaskResult } from "@/lib/utils/types";

// Generic fetch wrapper that handles errors
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Hook to fetch the task list with stats.
 * Auto-refreshes every 5 seconds for live dashboard updates.
 *
 * Returns:
 * - data.tasks: TaskResult[]
 * - data.total: number
 * - data.stats: { total, successful, failed, cached, recovered, patterns_learned, cache_hit_rate, recovery_rate }
 * - isLoading: boolean
 * - error: Error | undefined
 * - mutate: () => void  (force refresh)
 */
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
  }>("/api/tasks", fetcher, {
    refreshInterval: 5000, // Poll every 5 seconds
    revalidateOnFocus: true, // Refresh when user tabs back
    dedupingInterval: 2000, // Dedupe requests within 2 seconds
  });
}

/**
 * Hook to fetch a single task by ID.
 * Auto-refreshes every 2 seconds (faster for active task monitoring).
 *
 * @param id - The task UUID
 */
export function useTask(id: string) {
  return useSWR<TaskResult>(
    id ? `/api/tasks/${id}` : null, // null key = don't fetch
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: true,
    }
  );
}
```

### Patterns Hook

**File: `src/hooks/use-patterns.ts`**

```typescript
import useSWR from "swr";
import type { PagePattern } from "@/lib/utils/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

/**
 * Hook to fetch all learned patterns.
 * Auto-refreshes every 5 seconds.
 *
 * Returns:
 * - data.patterns: PagePattern[]
 * - data.total: number
 */
export function usePatterns() {
  return useSWR<{
    patterns: PagePattern[];
    total: number;
  }>("/api/patterns", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}
```

---

## Step 5.5: Stats Overview Component

**File: `src/components/stats-overview.tsx`**

Displays four metric cards at the top of the dashboard: Total Tasks, Patterns Learned, Cache Hit Rate, and Recovery Rate.

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Brain, Target, Zap, RefreshCw } from "lucide-react";

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

## Step 5.6: Task Submission Form

**File: `src/components/task-form.tsx`**

Form for submitting new scraping tasks. Shows a loading spinner while the task executes and displays errors inline.

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

      // Reset form on success
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
            placeholder="https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400 mb-1 block">
            What to extract
          </label>
          <Textarea
            placeholder='e.g., "book title and price"'
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            disabled={loading}
            rows={2}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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

      {/* Quick examples */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 mb-2">Quick examples:</p>
        <div className="space-y-1">
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html");
              setTarget("book title and price");
            }}
            disabled={loading}
          >
            books.toscrape.com → book title and price
          </button>
          <br />
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            onClick={() => {
              setUrl("https://quotes.toscrape.com/");
              setTarget("first quote text and author");
            }}
            disabled={loading}
          >
            quotes.toscrape.com → first quote and author
          </button>
        </div>
      </div>
    </Card>
  );
}
```

---

## Step 5.7: Task List Component

**File: `src/components/task-list.tsx`**

Displays a list of tasks with color-coded status badges. Each task links to its detail page.

```tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskResult } from "@/lib/utils/types";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react";

interface TaskListProps {
  tasks: TaskResult[];
}

/**
 * Determine the appropriate status badge for a task.
 * Priority order: Cached > Recovered > Success > Failed > Pending
 */
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

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago")
 */
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {task.url}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                {getStatusBadge(task)}
                <span className="text-xs text-zinc-600 w-16 text-right">
                  {task.steps.length} steps
                </span>
                <span className="text-xs text-zinc-600 w-16 text-right">
                  {timeAgo(task.created_at)}
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

## Step 5.8: Trace Timeline Component

**File: `src/components/trace-timeline.tsx`**

This is the **most demo-impactful component**. It shows a vertical timeline of every step in the learning scrape process, with color-coded dots, status badges, icons, and expandable screenshot thumbnails.

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskStep } from "@/lib/utils/types";
import {
  Search,
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Brain,
  Database,
  Info,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface TraceTimelineProps {
  steps: TaskStep[];
  screenshots: string[];
}

// Map action names to icons
const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
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
  cache_error: Info,
};

// Map statuses to card border/background colors
const statusColors: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/5",
  failure: "border-red-500/40 bg-red-500/5",
  recovery: "border-amber-500/40 bg-amber-500/5",
  info: "border-zinc-700 bg-zinc-900",
};

// Map statuses to timeline dot colors
const statusDotColors: Record<string, string> = {
  success: "bg-emerald-500",
  failure: "bg-red-500",
  recovery: "bg-amber-500",
  info: "bg-zinc-500",
};

// Map statuses to badge text colors
const statusBadgeColors: Record<string, string> = {
  success: "text-emerald-400 border-emerald-500/30",
  failure: "text-red-400 border-red-500/30",
  recovery: "text-amber-400 border-amber-500/30",
  info: "text-zinc-400 border-zinc-600",
};

/**
 * Format an action name from snake_case to Title Case
 * e.g., "vector_search" → "Vector Search"
 */
function formatActionName(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TraceTimeline({ steps, screenshots }: TraceTimelineProps) {
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(
    null
  );

  return (
    <>
      <div className="space-y-0">
        {steps.map((step, index) => {
          const Icon = actionIcons[step.action] || Info;
          const isLast = index === steps.length - 1;

          return (
            <div key={index} className="flex gap-4">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    statusDotColors[step.status]
                  } mt-1.5 ring-2 ring-zinc-950 shrink-0`}
                />
                {!isLast && (
                  <div className="w-px flex-1 bg-zinc-800 my-1" />
                )}
              </div>

              {/* Step content card */}
              <Card
                className={`flex-1 mb-3 p-4 border ${
                  statusColors[step.status]
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {/* Action name + status badge */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {formatActionName(step.action)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            statusBadgeColors[step.status]
                          }`}
                        >
                          {step.status}
                        </Badge>
                      </div>
                      {/* Detail text */}
                      <p className="text-sm text-zinc-400 break-words">
                        {step.detail}
                      </p>
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
      </div>

      {/* Expanded screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8 cursor-pointer"
          onClick={() => setExpandedScreenshot(null)}
        >
          <img
            src={`data:image/png;base64,${expandedScreenshot}`}
            alt="Full screenshot"
            className="max-w-full max-h-full rounded-lg border border-zinc-700 shadow-2xl"
          />
          <p className="absolute bottom-6 text-zinc-400 text-sm">
            Click anywhere to close
          </p>
        </div>
      )}
    </>
  );
}
```

---

## Step 5.9: Pattern Card Component

**File: `src/components/pattern-card.tsx`**

Displays a single learned pattern as a card showing the URL pattern, target, working selector, approach badge, and success count.

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

const approachLabels: Record<string, string> = {
  extract: "Direct Extract",
  act: "Act + Extract",
  agent: "Agent Recovery",
};

export function PatternCard({ pattern }: PatternCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 p-5 hover:border-zinc-700 transition-colors">
      {/* URL Pattern */}
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-sm font-mono text-emerald-400 truncate">
          {pattern.url_pattern}
        </span>
      </div>

      {/* Target */}
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-sm text-zinc-300">{pattern.target}</span>
      </div>

      {/* Working Selector */}
      <div className="flex items-start gap-2 mb-4">
        <Code className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <span className="text-xs text-zinc-500 font-mono line-clamp-2">
          {pattern.working_selector}
        </span>
      </div>

      {/* Footer: approach badge + success count */}
      <div className="flex items-center justify-between">
        <Badge
          className={
            approachColors[pattern.approach] || approachColors.extract
          }
        >
          {approachLabels[pattern.approach] || pattern.approach}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          Used {pattern.success_count} time
          {pattern.success_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Learned timestamp */}
      <p className="text-xs text-zinc-600 mt-3">
        Learned {new Date(pattern.created_at).toLocaleDateString()}
      </p>
    </Card>
  );
}
```

---

## Step 5.10: Pattern Grid Component

**File: `src/components/pattern-grid.tsx`**

Displays all patterns in a responsive 3-column grid.

```tsx
"use client";

import { PatternCard } from "./pattern-card";
import type { PagePattern } from "@/lib/utils/types";
import { Brain } from "lucide-react";

interface PatternGridProps {
  patterns: PagePattern[];
}

export function PatternGrid({ patterns }: PatternGridProps) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-16">
        <Brain className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500 text-lg">No patterns learned yet.</p>
        <p className="text-zinc-600 text-sm mt-1">
          Run some tasks and WebScout will start learning from successes and
          failures!
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

## Step 5.11: Dashboard Home Page

**File: `src/app/dashboard/page.tsx`**

The main dashboard page: stat cards, task submission form, and recent tasks side by side.

```tsx
"use client";

import { useTasks } from "@/hooks/use-tasks";
import { StatsOverview } from "@/components/stats-overview";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function DashboardPage() {
  const { data, isLoading, mutate } = useTasks();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-zinc-500 mt-1">
          Monitor WebScout's learning progress and run new tasks
        </p>
      </div>

      {/* Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : (
        <StatsOverview stats={data?.stats || defaultStats} />
      )}

      {/* Two-column layout: Form + Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Task submission form */}
        <TaskForm onTaskComplete={() => mutate()} />

        {/* Right: Recent tasks */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent Tasks
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-zinc-900 rounded-lg" />
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

## Step 5.12: Tasks List Page

**File: `src/app/tasks/page.tsx`**

Full page listing all tasks.

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
            <Skeleton key={i} className="h-16 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : (
        <TaskList tasks={data?.tasks || []} />
      )}
    </div>
  );
}
```

### Tasks Layout (shares sidebar)

**File: `src/app/tasks/layout.tsx`**

```tsx
import DashboardLayout from "@/app/dashboard/layout";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

---

## Step 5.13: Task Detail Page (with Trace Timeline)

**File: `src/app/tasks/[id]/page.tsx`**

The most important page for the demo. Shows the full task execution trace with screenshots.

```tsx
"use client";

import { useTask } from "@/hooks/use-tasks";
import { TraceTimeline } from "@/components/trace-timeline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Globe,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
} from "lucide-react";
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
        <Skeleton className="h-40 bg-zinc-900 rounded-lg" />
        <Skeleton className="h-96 bg-zinc-900 rounded-lg" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500">Task not found</p>
        <Link
          href="/tasks"
          className="text-sm text-emerald-400 hover:underline mt-2 inline-block"
        >
          Back to tasks
        </Link>
      </div>
    );
  }

  const duration = task.completed_at
    ? ((task.completed_at - task.created_at) / 1000).toFixed(1)
    : "...";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/tasks"
        className="text-sm text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to tasks
      </Link>

      {/* Task header card */}
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* URL */}
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-sm text-zinc-400 font-mono truncate">
                {task.url}
              </span>
            </div>
            {/* Target */}
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-lg text-white font-medium">
                {task.target}
              </span>
            </div>
            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {duration}s
              </span>
              <span>{task.steps.length} steps</span>
              {task.used_cached_pattern && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Zap className="w-3 h-3" /> Used cached pattern
                </span>
              )}
              {task.recovery_attempted && (
                <span className="flex items-center gap-1 text-amber-400">
                  <RefreshCw className="w-3 h-3" /> Recovery attempted
                </span>
              )}
              {task.pattern_id && (
                <span className="text-zinc-600">
                  Pattern: {task.pattern_id}
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          <Badge
            className={
              task.status === "success"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
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

        {/* Extracted data result */}
        {task.result && (
          <div className="mt-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
              Extracted Data
            </p>
            <pre className="text-sm text-emerald-400 whitespace-pre-wrap overflow-auto max-h-48 font-mono">
              {JSON.stringify(task.result, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Execution Trace Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Execution Trace
        </h3>
        <p className="text-sm text-zinc-500 mb-4">
          Step-by-step trace of the learning scrape process. Click screenshots
          to expand.
        </p>
        <TraceTimeline steps={task.steps} screenshots={task.screenshots} />
      </div>
    </div>
  );
}
```

---

## Step 5.14: Patterns Page (Failure Recovery Library)

**File: `src/app/patterns/page.tsx`**

Displays all learned patterns as a card grid — the "Failure Recovery Library."

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
          {data?.total || 0} patterns learned from past successes and
          recoveries
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          Each pattern represents a reusable approach for extracting data from
          a type of page. Patterns with higher success counts are more reliable.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : (
        <PatternGrid patterns={data?.patterns || []} />
      )}
    </div>
  );
}
```

### Patterns Layout (shares sidebar)

**File: `src/app/patterns/layout.tsx`**

```tsx
import DashboardLayout from "@/app/dashboard/layout";

export default function PatternsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

---

## Step 5.15: File Structure After Phase 5

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with dark theme (Step 5.1)
│   ├── page.tsx                      # Redirect to /dashboard (Step 5.2)
│   ├── globals.css                   # (from Phase 1)
│   ├── dashboard/
│   │   ├── layout.tsx                # Sidebar navigation (Step 5.3)
│   │   └── page.tsx                  # Dashboard home (Step 5.11)
│   ├── tasks/
│   │   ├── layout.tsx                # Shares dashboard layout (Step 5.12)
│   │   ├── page.tsx                  # All tasks list (Step 5.12)
│   │   └── [id]/
│   │       └── page.tsx              # Task detail + trace (Step 5.13)
│   ├── patterns/
│   │   ├── layout.tsx                # Shares dashboard layout (Step 5.14)
│   │   └── page.tsx                  # Failure Recovery Library (Step 5.14)
│   └── api/                          # (from Phase 4)
│       ├── tasks/...
│       ├── patterns/...
│       └── health/...
├── components/
│   ├── ui/                           # shadcn/ui primitives (from Phase 1)
│   ├── theme-provider.tsx            # (from Phase 1)
│   ├── stats-overview.tsx            # Dashboard stat cards (Step 5.5)
│   ├── task-form.tsx                 # Task submission form (Step 5.6)
│   ├── task-list.tsx                 # Task list with badges (Step 5.7)
│   ├── trace-timeline.tsx            # Trace timeline (Step 5.8)
│   ├── pattern-card.tsx              # Single pattern card (Step 5.9)
│   └── pattern-grid.tsx              # Pattern card grid (Step 5.10)
├── hooks/
│   ├── use-tasks.ts                  # SWR hook for tasks (Step 5.4)
│   └── use-patterns.ts              # SWR hook for patterns (Step 5.4)
└── lib/                              # (from Phases 2-3)
```

---

## Step 5.16: Testing & Debugging

### Visual Testing Walkthrough

After starting the dev server (`npm run dev`):

#### 1. Dashboard Home (`http://localhost:3000/dashboard`)

**Check:**
- [ ] Dark background (zinc-950)
- [ ] Sidebar visible on the left with WebScout logo
- [ ] Three nav links: Dashboard, Tasks, Recovery Library
- [ ] Dashboard link highlighted/active
- [ ] Four stat cards showing (all zeros initially)
- [ ] Task form on the left column
- [ ] "Recent Tasks" section on the right column
- [ ] Empty state: "No tasks yet. Submit your first task above!"

#### 2. Submit a Task

**Action:** Fill in the task form and click "Run Task"

**Check:**
- [ ] Button shows loading spinner and "Running scrape..." text
- [ ] Form inputs are disabled during execution
- [ ] On success: form resets, task appears in Recent Tasks
- [ ] On error: red error message appears below the form
- [ ] Stats update after submission (Total Tasks increments)

#### 3. Task Detail (`http://localhost:3000/tasks/{id}`)

**Action:** Click a task in the list

**Check:**
- [ ] "Back to tasks" link visible
- [ ] Task header shows URL (monospace), target (bold), duration, step count
- [ ] Status badge (green for success, red for failure)
- [ ] "Used cached pattern" / "Recovery attempted" labels visible when applicable
- [ ] Extracted data shown in formatted JSON (green monospace)
- [ ] Trace timeline shows every step with:
  - [ ] Color-coded dots (green/red/amber/gray)
  - [ ] Icons matching each action type
  - [ ] Status badges (success/failure/recovery/info)
  - [ ] Detail text explaining what happened
  - [ ] Timestamps on the right
- [ ] Screenshot thumbnails render inline
- [ ] Clicking a screenshot opens fullscreen modal
- [ ] Clicking modal backdrop closes it

#### 4. Tasks Page (`http://localhost:3000/tasks`)

**Check:**
- [ ] All tasks listed with status badges
- [ ] Tasks link to their detail pages
- [ ] Total count shown in header

#### 5. Patterns Page (`http://localhost:3000/patterns`)

**Check:**
- [ ] Shows "Failure Recovery Library" heading with brain icon
- [ ] Pattern count in subheading
- [ ] 3-column grid of pattern cards
- [ ] Each card shows: URL pattern, target, selector, approach badge, success count
- [ ] Empty state with brain icon and helpful message

#### 6. Auto-Refresh

**Action:** Leave the dashboard open, submit a task via cURL in a separate terminal

**Check:**
- [ ] Dashboard updates within 5 seconds (SWR polling)
- [ ] New task appears in the list
- [ ] Stats update automatically

#### 7. Responsive Layout

**Check:**
- [ ] Stats cards: 4 cols on desktop, 2 on tablet, 1 on mobile
- [ ] Dashboard: 2 cols on desktop, 1 on mobile
- [ ] Pattern grid: 3 cols on desktop, 2 on tablet, 1 on mobile
- [ ] Sidebar stays fixed width (w-64)

---

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| Blank page / hydration error | Server-client mismatch (usually theme) | Ensure `suppressHydrationWarning` on `<html>` tag |
| `useRouter` error in layout | Dashboard layout uses hooks but missing `"use client"` | Add `"use client"` directive to layout.tsx |
| SWR not refreshing | fetcher function throwing or returning wrong data | Check browser Network tab for API errors |
| Screenshots not rendering | Base64 string is empty or truncated | Check `captureScreenshot()` in trace-context.ts |
| Sidebar links not active | `usePathname()` returning unexpected path | Check pathname matching logic in layout |
| Dark mode not applying | Missing ThemeProvider or dark class | Ensure ThemeProvider wraps children with `defaultTheme="dark"` |
| Badge component not styled | Missing shadcn badge component | Run `npx shadcn@latest add badge` |
| Icons not rendering | Missing lucide-react import | Ensure `npm install lucide-react` was run |
| `TypeError: data?.tasks.map is not a function` | API returned an error object instead of task array | Check SWR error state and API response format |
| Layout not shared between pages | Tasks/Patterns not importing DashboardLayout | Add layout.tsx files that wrap with DashboardLayout |

### Debug Checklist

- [ ] `npm run dev` starts without errors
- [ ] `http://localhost:3000` redirects to `/dashboard`
- [ ] Dashboard loads with dark theme
- [ ] Sidebar navigation works (all 3 links)
- [ ] Active nav link is highlighted
- [ ] Task form submits and shows loading state
- [ ] Task list populates after submission
- [ ] Task detail page shows trace timeline
- [ ] Screenshots render and expand on click
- [ ] Patterns page shows learned patterns
- [ ] SWR auto-refreshes every 5 seconds
- [ ] No console errors in browser DevTools
- [ ] `npx tsc --noEmit` produces no errors
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds

---

## Step 5.17: GitHub Actions Workflow

**File: `.github/workflows/phase-5-dashboard.yml`**

```yaml
# Phase 5 - Dashboard UI Verification
# Verifies: Components compile, pages render, build succeeds
name: Phase 5 - Dashboard UI

on:
  push:
    branches: [main]
    paths:
      - 'webscout/src/app/**'
      - 'webscout/src/components/**'
      - 'webscout/src/hooks/**'
  pull_request:
    branches: [main]
    paths:
      - 'webscout/src/app/**'
      - 'webscout/src/components/**'
      - 'webscout/src/hooks/**'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-verify:
    name: Build & Verify Dashboard
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

      - name: Verify page files exist
        run: |
          echo "Checking page files..."
          test -f webscout/src/app/page.tsx && echo "✓ Root page (redirect)" || exit 1
          test -f webscout/src/app/layout.tsx && echo "✓ Root layout" || exit 1
          test -f webscout/src/app/dashboard/page.tsx && echo "✓ Dashboard page" || exit 1
          test -f webscout/src/app/dashboard/layout.tsx && echo "✓ Dashboard layout" || exit 1
          test -f webscout/src/app/tasks/page.tsx && echo "✓ Tasks page" || exit 1
          test -f webscout/src/app/tasks/layout.tsx && echo "✓ Tasks layout" || exit 1
          test -f webscout/src/app/tasks/\[id\]/page.tsx && echo "✓ Task detail page" || exit 1
          test -f webscout/src/app/patterns/page.tsx && echo "✓ Patterns page" || exit 1
          test -f webscout/src/app/patterns/layout.tsx && echo "✓ Patterns layout" || exit 1

      - name: Verify component files exist
        run: |
          echo "Checking component files..."
          test -f webscout/src/components/stats-overview.tsx && echo "✓ StatsOverview" || exit 1
          test -f webscout/src/components/task-form.tsx && echo "✓ TaskForm" || exit 1
          test -f webscout/src/components/task-list.tsx && echo "✓ TaskList" || exit 1
          test -f webscout/src/components/trace-timeline.tsx && echo "✓ TraceTimeline" || exit 1
          test -f webscout/src/components/pattern-card.tsx && echo "✓ PatternCard" || exit 1
          test -f webscout/src/components/pattern-grid.tsx && echo "✓ PatternGrid" || exit 1

      - name: Verify hook files exist
        run: |
          echo "Checking hook files..."
          test -f webscout/src/hooks/use-tasks.ts && echo "✓ useTasks hook" || exit 1
          test -f webscout/src/hooks/use-patterns.ts && echo "✓ usePatterns hook" || exit 1

      - name: Count shadcn/ui components
        run: |
          COUNT=$(ls webscout/src/components/ui/*.tsx 2>/dev/null | wc -l)
          echo "Found $COUNT shadcn/ui components"
          [ "$COUNT" -ge 8 ] && echo "✓ Enough UI components installed" || echo "⚠ Expected at least 8 UI components"
```

---

## File Checklist

| File | Status | Created By |
|------|--------|------------|
| `webscout/src/app/layout.tsx` | **UPDATED** | Step 5.1 |
| `webscout/src/app/page.tsx` | **UPDATED** | Step 5.2 |
| `webscout/src/app/dashboard/layout.tsx` | **NEW** | Step 5.3 |
| `webscout/src/app/dashboard/page.tsx` | **NEW** | Step 5.11 |
| `webscout/src/app/tasks/layout.tsx` | **NEW** | Step 5.12 |
| `webscout/src/app/tasks/page.tsx` | **NEW** | Step 5.12 |
| `webscout/src/app/tasks/[id]/page.tsx` | **NEW** | Step 5.13 |
| `webscout/src/app/patterns/layout.tsx` | **NEW** | Step 5.14 |
| `webscout/src/app/patterns/page.tsx` | **NEW** | Step 5.14 |
| `webscout/src/components/stats-overview.tsx` | **NEW** | Step 5.5 |
| `webscout/src/components/task-form.tsx` | **NEW** | Step 5.6 |
| `webscout/src/components/task-list.tsx` | **NEW** | Step 5.7 |
| `webscout/src/components/trace-timeline.tsx` | **NEW** | Step 5.8 |
| `webscout/src/components/pattern-card.tsx` | **NEW** | Step 5.9 |
| `webscout/src/components/pattern-grid.tsx` | **NEW** | Step 5.10 |
| `webscout/src/hooks/use-tasks.ts` | **NEW** | Step 5.4 |
| `webscout/src/hooks/use-patterns.ts` | **NEW** | Step 5.4 |
| `.github/workflows/phase-5-dashboard.yml` | **NEW** | Step 5.17 |

**Total: 18 files (9 pages, 6 components, 2 hooks, 1 workflow)**

---

**Phase 5 Complete.** You now have a fully functional dark-themed dashboard with real-time stats, task submission, trace timeline visualization, screenshot viewer, and a Failure Recovery Library. **Next: Phase 6 — Demo Preparation & Deployment.**
