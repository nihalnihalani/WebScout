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

function formatActionName(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  success: "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10",
  failure: "border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
  recovery: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10",
  info: "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60",
};

// Map statuses to timeline dot colors
const statusDotColors: Record<string, string> = {
  success: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
  failure: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
  recovery: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
  info: "bg-zinc-500",
};

// ... existing code ...

export function TraceTimeline({ steps }: TraceTimelineProps) {
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(
    null
  );

  return (
    <>
      <div className="space-y-0 relative">
        {/* Continuous timeline line background */}
        <div className="absolute left-[5px] top-2 bottom-4 w-px bg-zinc-800/50" />
        
        {steps.map((step, index) => {
          const Icon = actionIcons[step.action] || Info;
          // const isLast = index === steps.length - 1; // Removed as we use absolute line

          return (
            <div key={index} className="flex gap-6 relative group">
              {/* Timeline dot */}
              <div className="flex flex-col items-center z-10">
                <div
                  className={`w-3 h-3 rounded-full ${
                    statusDotColors[step.status]
                  } mt-6 ring-4 ring-black/50 transition-transform duration-300 group-hover:scale-125 shrink-0`}
                />
              </div>

              {/* Step content card */}
              <Card
                className={`flex-1 mb-4 p-5 border backdrop-blur-sm transition-all duration-300 ${
                  statusColors[step.status]
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-2 rounded-md bg-zinc-950/50 border border-white/5">
                      <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Action name + status badge */}
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white tracking-wide">
                          {formatActionName(step.action)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0 h-5 uppercase tracking-wider ${
                            statusColors[step.status]
                          }`}
                        >
                          {step.status}
                        </Badge>
                      </div>
                      {/* Detail text */}
                      <p className="text-sm text-zinc-400 break-words font-mono leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs font-mono text-zinc-600 shrink-0 mt-1">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Screenshot thumbnail */}
                {step.screenshot && (
                  <div className="mt-4 ml-12 relative group/image inline-block">
                    <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover/image:opacity-100 transition-opacity rounded border border-emerald-500/20 pointer-events-none" />
                    <img
                      src={`data:image/png;base64,${step.screenshot}`}
                      alt={`Screenshot: ${step.action}`}
                      className="rounded border border-zinc-700 max-w-[200px] h-auto cursor-pointer hover:brightness-110 transition-all shadow-lg"
                      onClick={() => setExpandedScreenshot(step.screenshot!)}
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-[10px] text-white font-mono rounded opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none">
                      IMG_CAPTURED
                    </div>
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
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-8 cursor-pointer animate-fade-in"
          onClick={() => setExpandedScreenshot(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-emerald-500 -translate-x-2 -translate-y-2" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-emerald-500 translate-x-2 -translate-y-2" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-emerald-500 -translate-x-2 translate-y-2" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-emerald-500 translate-x-2 translate-y-2" />
            
            <img
              src={`data:image/png;base64,${expandedScreenshot}`}
              alt="Full screenshot"
              className="max-w-full max-h-[85vh] rounded-sm shadow-2xl"
            />
            <p className="mt-4 text-center text-zinc-500 text-sm font-mono">
              [CLICK ANYWHERE TO CLOSE]
            </p>
          </div>
        </div>
      )}
    </>
  );
}
