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

// Map statuses to text colors (Brighter for better contrast)
const statusTextColors: Record<string, string> = {
  success: "text-emerald-300",
  failure: "text-red-300",
  recovery: "text-amber-300",
  info: "text-blue-300",
};

// Map statuses to badge styles
const statusBadgeStyles: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
  failure: "bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
  recovery: "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
  info: "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
};

// Map statuses to icon colors
const statusIconColors: Record<string, string> = {
  success: "text-emerald-400",
  failure: "text-red-400",
  recovery: "text-amber-400",
  info: "text-blue-400",
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
    <div className="relative flex flex-col h-full rounded-lg overflow-hidden border border-zinc-800 bg-black shadow-inner group">
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%] opacity-20 animate-crt-flicker" />
      
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 z-20 relative">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-mono font-medium text-emerald-500/80 uppercase tracking-widest">
            Execution Log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 font-mono">
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </span>
          {isRunning && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium font-mono uppercase tracking-wider">
                LIVE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 font-mono text-xs scrollbar-thin relative z-0 tracking-wide"
      >
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No execution steps yet</p>
            <p className="text-[10px] mt-1 text-zinc-700">
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
                className={`group flex items-start gap-3 px-3 py-2 rounded transition-colors hover:bg-zinc-900/30 ${
                  isNew ? "animate-fade-in bg-emerald-900/10" : ""
                }`}
              >
                {/* Timestamp */}
                <span className="text-zinc-600 shrink-0 w-[64px] tabular-nums opacity-60">
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
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className={`font-semibold tracking-tight ${
                        statusTextColors[step.status] || "text-zinc-400"
                      }`}
                    >
                      {formatActionName(step.action)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider font-medium ${
                        statusBadgeStyles[step.status] || ""
                      }`}
                    >
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-zinc-400 wrap-break-word leading-relaxed text-[11px] opacity-90 tracking-wide">
                    {step.detail}
                  </p>
                </div>

                {/* Screenshot indicator */}
                {step.screenshot && (
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                )}
              </div>
            );
          })
        )}

        {/* Running indicator at bottom */}
        {isRunning && steps.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-emerald-500/50 animate-pulse">
            <span className="w-[64px]" />
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-emerald-500/50" />
            </div>
            <span className="text-[10px] uppercase tracking-wider">Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
