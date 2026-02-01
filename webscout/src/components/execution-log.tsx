"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
  Terminal,
} from "lucide-react";

interface ExecutionLogProps {
  steps: TaskStep[];
  isRunning: boolean;
}

// Map action names to icons
const actionIcons: Record<string, React.ComponentType<{ className?: string }>> =
  {
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

// Map statuses to text colors
const statusTextColors: Record<string, string> = {
  success: "text-emerald-400",
  failure: "text-red-400",
  recovery: "text-amber-400",
  info: "text-blue-400",
};

// Map statuses to badge styles
const statusBadgeStyles: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failure: "bg-red-500/15 text-red-400 border-red-500/30",
  recovery: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// Map statuses to icon colors
const statusIconColors: Record<string, string> = {
  success: "text-emerald-500",
  failure: "text-red-500",
  recovery: "text-amber-500",
  info: "text-blue-500",
};

function formatActionName(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ExecutionLog({ steps, isRunning }: ExecutionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStepCountRef = useRef(0);

  // Auto-scroll to bottom when new steps appear
  useEffect(() => {
    if (steps.length > prevStepCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevStepCountRef.current = steps.length;
  }, [steps.length]);

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">
            Execution Log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600">
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </span>
          {isRunning && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">
                LIVE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 font-mono text-xs scrollbar-thin"
      >
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No execution steps yet</p>
            <p className="text-[10px] mt-1">
              {isRunning
                ? "Waiting for first step..."
                : "Run a task to see execution log"}
            </p>
          </div>
        ) : (
          steps.map((step, index) => {
            const Icon = actionIcons[step.action] || Info;
            const isNew = index === steps.length - 1 && isRunning;

            return (
              <div
                key={`${step.timestamp}-${index}`}
                className={`group flex items-start gap-2 px-2 py-1.5 rounded transition-colors hover:bg-zinc-900/50 ${
                  isNew ? "animate-fade-in bg-zinc-900/30" : ""
                }`}
              >
                {/* Timestamp */}
                <span className="text-zinc-600 shrink-0 w-[60px] tabular-nums">
                  {formatTimestamp(step.timestamp)}
                </span>

                {/* Icon */}
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    statusIconColors[step.status] || "text-zinc-500"
                  }`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-semibold ${
                        statusTextColors[step.status] || "text-zinc-400"
                      }`}
                    >
                      {formatActionName(step.action)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${
                        statusBadgeStyles[step.status] || ""
                      }`}
                    >
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-zinc-500 break-words mt-0.5 leading-relaxed">
                    {step.detail}
                  </p>
                </div>

                {/* Screenshot indicator */}
                {step.screenshot && (
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            );
          })
        )}

        {/* Running indicator at bottom */}
        {isRunning && steps.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-zinc-600">
            <span className="w-[60px]" />
            <div className="flex gap-1">
              <div
                className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-[10px]">Waiting for next step...</span>
          </div>
        )}
      </div>
    </div>
  );
}
