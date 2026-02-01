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
 * e.g., "vector_search" -> "Vector Search"
 */
function formatActionName(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TraceTimeline({ steps }: TraceTimelineProps) {
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
