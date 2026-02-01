"use client";

import { useState } from "react";
import { useTimeline } from "@/hooks/use-timeline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskResult, TaskStep } from "@/lib/utils/types";
import {
  Brain,
  Zap,
  Globe,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Camera,
  Clock,
  ArrowRight,
  Sparkles,
  Database,
  Eye,
  Rocket,
  History,
} from "lucide-react";
import { EmptyState } from "./empty-state";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function durationMs(task: TaskResult): string {
  if (!task.completed_at) return "running...";
  const ms = task.completed_at - task.created_at;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* -------------------------------------------------------------------------- */
/*  Thought-process mapping                                                    */
/* -------------------------------------------------------------------------- */

interface ThoughtLine {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string; // tailwind text color
  bgColor: string; // tailwind bg color for the icon circle
}

const thoughtMap: Record<string, ThoughtLine> = {
  vector_search: {
    icon: Search,
    label: "Searching memory...",
    color: "text-violet-400",
    bgColor: "bg-violet-500/20",
  },
  cache_hit: {
    icon: Zap,
    label: "Found cached pattern!",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  cache_miss: {
    icon: Search,
    label: "No matching pattern found",
    color: "text-zinc-400",
    bgColor: "bg-zinc-700/50",
  },
  browser_init: {
    icon: Globe,
    label: "Launching browser...",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  navigate: {
    icon: ArrowRight,
    label: "Navigating to site...",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  cached_extract: {
    icon: Zap,
    label: "Trying cached approach...",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  fresh_extract: {
    icon: Eye,
    label: "Attempting fresh extraction...",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
  },
  recovery_start: {
    icon: RefreshCw,
    label: "Starting recovery...",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
  },
  recovery_success: {
    icon: CheckCircle2,
    label: "Recovery successful!",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  recovery_failed: {
    icon: XCircle,
    label: "Recovery failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  pattern_stored: {
    icon: Database,
    label: "Pattern stored in memory",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  pattern_learned: {
    icon: Brain,
    label: "Pattern learned!",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  cache_error: {
    icon: XCircle,
    label: "Cache error",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
};

const defaultThought: ThoughtLine = {
  icon: ArrowRight,
  label: "Processing...",
  color: "text-zinc-400",
  bgColor: "bg-zinc-700/50",
};

function getThought(step: TaskStep): ThoughtLine {
  return thoughtMap[step.action] || defaultThought;
}

/* -------------------------------------------------------------------------- */
/*  Badge for each task entry                                                  */
/* -------------------------------------------------------------------------- */

function getEntryBadge(task: TaskResult) {
  if (task.status === "failed") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
        <XCircle className="w-3 h-3 mr-0.5" />
        Failed
      </Badge>
    );
  }
  if (task.used_cached_pattern) {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
        <Zap className="w-3 h-3 mr-0.5" />
        Cached
      </Badge>
    );
  }
  if (task.recovery_attempted && task.status === "success") {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
        <RefreshCw className="w-3 h-3 mr-0.5" />
        Recovered
      </Badge>
    );
  }
  // Check if a pattern was learned (pattern_id exists means it stored a new one)
  if (task.pattern_id) {
    return (
      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0">
        <Brain className="w-3 h-3 mr-0.5" />
        Learned
      </Badge>
    );
  }
  if (task.status === "success") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
        <CheckCircle2 className="w-3 h-3 mr-0.5" />
        Success
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[10px] px-1.5 py-0">
      <Clock className="w-3 h-3 mr-0.5" />
      {task.status}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Border color for task status                                               */
/* -------------------------------------------------------------------------- */

function getBorderColor(task: TaskResult): string {
  if (task.status === "success") return "border-l-emerald-500";
  if (task.status === "failed") return "border-l-red-500";
  if (task.status === "running") return "border-l-amber-500";
  return "border-l-zinc-600";
}

function getDotColor(task: TaskResult): string {
  if (task.status === "success") return "bg-emerald-500";
  if (task.status === "failed") return "bg-red-500";
  if (task.status === "running") return "bg-amber-500 animate-pulse";
  return "bg-zinc-600";
}

/* -------------------------------------------------------------------------- */
/*  Step detail row                                                            */
/* -------------------------------------------------------------------------- */

function StepRow({
  step,
  isLast,
  onScreenshotClick,
}: {
  step: TaskStep;
  isLast: boolean;
  onScreenshotClick: (src: string) => void;
}) {
  const thought = getThought(step);
  const Icon = thought.icon;

  return (
    <div className="flex gap-3 group">
      {/* Mini timeline connector */}
      <div className="flex flex-col items-center w-6 shrink-0">
        <div
          className={`w-6 h-6 rounded-full ${thought.bgColor} flex items-center justify-center shrink-0 ring-2 ring-zinc-950 transition-transform group-hover:scale-110`}
        >
          <Icon className={`w-3 h-3 ${thought.color}`} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-linear-to-b from-zinc-700 to-zinc-800/50 my-0.5" />
        )}
      </div>

      {/* Step content */}
      <div className={`flex-1 ${isLast ? "pb-0" : "pb-3"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium ${thought.color}`}>
            {thought.label}
          </span>
          <span className="text-[10px] text-zinc-600">
            {formatTime(step.timestamp)}
          </span>
          {step.status === "failure" && (
            <span className="text-[10px] text-red-400 font-medium">
              FAILED
            </span>
          )}
          {step.status === "recovery" && (
            <span className="text-[10px] text-amber-400 font-medium">
              RECOVERY
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed wrap-break-word">
          {step.detail}
        </p>

        {/* Screenshot thumbnail */}
        {step.screenshot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScreenshotClick(step.screenshot!);
            }}
            className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors group/ss"
          >
            <Camera className="w-3 h-3" />
            <img
              src={`data:image/png;base64,${step.screenshot}`}
              alt={`Screenshot: ${step.action}`}
              className="h-12 rounded border border-zinc-700 opacity-70 group-hover/ss:opacity-100 transition-opacity"
            />
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Timeline entry (one per task)                                              */
/* -------------------------------------------------------------------------- */

function TimelineEntry({
  task,
  index,
  isLast,
  isExpanded,
  onToggle,
  onScreenshotClick,
}: {
  task: TaskResult;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onScreenshotClick: (src: string) => void;
}) {
  const borderColor = getBorderColor(task);
  const dotColor = getDotColor(task);
  const hasLearnedPattern = task.steps.some(
    (s) => s.action === "pattern_learned" || s.action === "pattern_stored"
  );
  const usedCache = task.used_cached_pattern;

  return (
    <div
      className="flex gap-4 animate-in fade-in slide-in-from-left-2"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
    >
      {/* Vertical timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div
          className={`w-3.5 h-3.5 rounded-full ${dotColor} mt-5 ring-[3px] ring-zinc-950 shrink-0 z-10`}
        />
        {!isLast && (
          <div className="w-px flex-1 bg-linear-to-b from-zinc-700 via-zinc-800 to-zinc-900 my-1 timeline-line" />
        )}
      </div>

      {/* Entry card */}
      <div className="flex-1 pb-6 min-w-0">
        <Card
          className={`bg-zinc-900/80 border-zinc-800 border-l-[3px] ${borderColor} cursor-pointer hover:bg-zinc-800/60 transition-all duration-200 overflow-hidden backdrop-blur-sm`}
          onClick={onToggle}
        >
          {/* Header */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Expand chevron */}
                <div className="mt-0.5 shrink-0 text-zinc-500">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Target description */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">
                      {task.target}
                    </p>
                    {/* Special icons */}
                    {hasLearnedPattern && (
                      <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                    {usedCache && (
                      <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                  </div>

                  {/* URL */}
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {task.url}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {getEntryBadge(task)}
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {durationMs(task)}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {task.steps.length} steps
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-zinc-600 shrink-0 mt-1">
                {timeAgo(task.created_at)}
              </span>
            </div>
          </div>

          {/* Expandable step-by-step breakdown */}
          {isExpanded && (
            <div className="border-t border-zinc-800 bg-zinc-950/50 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Agent Thought Process
                </span>
              </div>

              <div className="ml-1">
                {task.steps.map((step, i) => (
                  <StepRow
                    key={`${task.id}-step-${i}`}
                    step={step}
                    isLast={i === task.steps.length - 1}
                    onScreenshotClick={onScreenshotClick}
                  />
                ))}
              </div>

              {/* Result summary */}
              {task.result && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                    Extracted Result
                  </p>
                  <pre className="text-[11px] text-zinc-400 bg-zinc-900 rounded p-2 overflow-x-auto max-h-32 scrollbar-thin">
                    {typeof task.result === "string"
                      ? task.result
                      : JSON.stringify(task.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Screenshots gallery */}
              {task.screenshots.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    Screenshots ({task.screenshots.length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {task.screenshots.map((ss, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          onScreenshotClick(ss);
                        }}
                        className="shrink-0"
                      >
                        <img
                          src={`data:image/png;base64,${ss}`}
                          alt={`Screenshot ${i + 1}`}
                          className="h-16 rounded border border-zinc-700 hover:border-zinc-500 transition-colors"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyTimeline() {
  return (
    <EmptyState
      icon={History}
      secondaryIcon={Rocket}
      title="No History Recorded"
      description="The system is waiting for its first assignment. Dispatch a task to initialize the learning timeline."
      className="bg-zinc-900/50 border-zinc-800/50"
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading skeleton                                                           */
/* -------------------------------------------------------------------------- */

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center w-8">
            <Skeleton className="w-3.5 h-3.5 rounded-full bg-zinc-800" />
            {i < 2 && <Skeleton className="w-px flex-1 bg-zinc-800 my-1" />}
          </div>
          <div className="flex-1 pb-6">
            <Skeleton className="h-24 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function LearningTimeline() {
  const { data, isLoading, error } = useTimeline();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(
    null
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6 relative overflow-hidden shadow-xl">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-linear-to-tr from-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Neural Timeline
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                System thought process &amp; evolution
              </p>
            </div>
          </div>
          {data?.tasks && data.tasks.length > 0 && (
            <span className="text-[10px] font-mono font-medium text-zinc-500 bg-zinc-800/50 px-2.5 py-1 rounded border border-zinc-700/50">
              {data.tasks.length} EVENTS LOGGED
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="relative text-center py-8">
          <p className="text-sm text-red-400">
            Failed to load timeline: {error.message}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <TimelineSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && (!data?.tasks || data.tasks.length === 0) && (
        <EmptyTimeline />
      )}

      {/* Timeline entries */}
      {!isLoading && data?.tasks && data.tasks.length > 0 && (
        <div className="relative">
          {data.tasks.map((task, index) => (
            <TimelineEntry
              key={task.id}
              task={task}
              index={index}
              isLast={index === data.tasks.length - 1}
              isExpanded={expandedIds.has(task.id)}
              onToggle={() => toggleExpanded(task.id)}
              onScreenshotClick={setExpandedScreenshot}
            />
          ))}
        </div>
      )}

      {/* Full-screen screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-8 cursor-pointer backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setExpandedScreenshot(null)}
        >
          <img
            src={`data:image/png;base64,${expandedScreenshot}`}
            alt="Full screenshot"
            className="max-w-full max-h-full rounded-lg border border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200"
          />
          <p className="absolute bottom-6 text-zinc-400 text-sm font-mono">
            [CLICK ANYWHERE TO CLOSE]
          </p>
        </div>
      )}
    </Card>
  );
}
