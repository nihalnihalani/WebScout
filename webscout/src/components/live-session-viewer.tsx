"use client";

import { useState } from "react";
import type { TaskResult, TaskStep } from "@/lib/utils/types";
import {
  Globe,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Lock,
  Maximize2,
  Monitor,
} from "lucide-react";

interface LiveSessionViewerProps {
  task: TaskResult | null;
  isRunning: boolean;
}

export function LiveSessionViewer({ task, isRunning }: LiveSessionViewerProps) {
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(
    null
  );

  // Find the latest screenshot from task steps
  const latestScreenshot = task?.steps
    ?.slice()
    .reverse()
    .find((s: TaskStep) => s.screenshot)?.screenshot;

  const currentUrl = task?.url || "";

  return (
    <>
      <div className="flex flex-col h-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
        {/* Browser chrome - title bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-0.5 ml-2">
            <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Address bar */}
          <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700/50 mx-2">
            {currentUrl ? (
              <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
            )}
            <span className="text-xs text-zinc-400 font-mono truncate">
              {currentUrl || "about:blank"}
            </span>
            {isRunning && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </div>

          {/* Expand button */}
          {latestScreenshot && (
            <button
              onClick={() => setExpandedScreenshot(latestScreenshot)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              title="Expand screenshot"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Viewport area */}
        <div className="flex-1 relative bg-zinc-950 min-h-0">
          {!task ? (
            /* No session - waiting state */
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-6">
                <Monitor className="w-16 h-16 text-zinc-800" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex gap-1 mt-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-zinc-600 font-medium">
                Waiting for session...
              </p>
              <p className="text-xs text-zinc-700 mt-1">
                Run a task to start a live browser session
              </p>
            </div>
          ) : latestScreenshot ? (
            /* Active session with screenshot */
            <div className="absolute inset-0 flex items-center justify-center p-2 overflow-hidden">
              <img
                src={`data:image/png;base64,${latestScreenshot}`}
                alt="Live browser session"
                className="max-w-full max-h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setExpandedScreenshot(latestScreenshot)}
              />
              {isRunning && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                    Live
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Active session but no screenshots yet */
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <Globe className="w-12 h-12 text-zinc-700" />
                {isRunning && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <p className="text-sm text-zinc-500 font-medium">
                {isRunning
                  ? "Browser session active"
                  : "Session complete"}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {isRunning
                  ? "Waiting for first screenshot..."
                  : "No screenshots captured"}
              </p>
              {task.id && (
                <p className="text-[10px] text-zinc-700 font-mono mt-3">
                  Session: {task.id.slice(0, 12)}...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-t border-zinc-800 text-[10px] text-zinc-600">
          <div className="flex items-center gap-3">
            {task ? (
              <>
                <span className="flex items-center gap-1">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning
                        ? "bg-emerald-500 animate-pulse"
                        : task.status === "success"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  />
                  {isRunning ? "Connected" : task.status}
                </span>
                <span className="text-zinc-700">|</span>
                <span>Session: {task.id.slice(0, 8)}</span>
              </>
            ) : (
              <span>Disconnected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {task && (
              <>
                <span>{task.steps.length} steps</span>
                <span>{task.screenshots.length} captures</span>
              </>
            )}
            <span>Browserbase + Stagehand</span>
          </div>
        </div>
      </div>

      {/* Expanded screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-8 cursor-pointer backdrop-blur-sm"
          onClick={() => setExpandedScreenshot(null)}
        >
          <img
            src={`data:image/png;base64,${expandedScreenshot}`}
            alt="Full screenshot"
            className="max-w-full max-h-full rounded-lg border border-zinc-700 shadow-2xl"
          />
          <p className="absolute bottom-6 text-zinc-500 text-sm">
            Click anywhere to close
          </p>
        </div>
      )}
    </>
  );
}
