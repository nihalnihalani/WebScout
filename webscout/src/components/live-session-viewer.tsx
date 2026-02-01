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
  ExternalLink,
  Eye,
  Radio,
} from "lucide-react";

interface LiveSessionViewerProps {
  task: TaskResult | null;
  isRunning: boolean;
  sessionUrl?: string;
}

export function LiveSessionViewer({ task, isRunning, sessionUrl }: LiveSessionViewerProps) {
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(
    null
  );
  const [showLiveSession, setShowLiveSession] = useState(false);

  // Resolve session URL from prop or task data
  const resolvedSessionUrl = sessionUrl || task?.session_url;

  // Find the latest screenshot from task steps
  const latestScreenshot = task?.steps
    ?.slice()
    .reverse()
    .find((s: TaskStep) => s.screenshot)?.screenshot;

  const currentUrl = task?.url || "";

  return (
    <>
      <div className="flex flex-col h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl ring-1 ring-white/5">
        {/* Browser chrome - title bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-black border-b border-white/5">
            {/* Traffic lights */}
            <div className="flex items-center gap-2 ml-1">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_10px_rgba(255,95,86,0.3)] border border-[#FF5F56]/20" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_10px_rgba(255,189,46,0.3)] border border-[#FFBD2E]/20" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_10px_rgba(39,201,63,0.3)] border border-[#27C93F]/20" />
            </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-1 ml-3">
            <button className="p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Address bar */}
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5 mx-2 shadow-inner group transition-colors hover:border-white/10 hover:bg-zinc-900">
            {currentUrl ? (
              <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-zinc-600 shrink-0 group-hover:text-zinc-500 transition-colors" />
            )}
            <span className="text-xs text-zinc-400 font-mono truncate tracking-wide">
              {currentUrl || "about:blank"}
            </span>
            {isRunning && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_currentColor]" />
              </div>
            )}
          </div>

          {/* Watch Live / Open Session button */}
          {resolvedSessionUrl && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowLiveSession(!showLiveSession)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  showLiveSession
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
                }`}
                title={showLiveSession ? "Switch to screenshots" : "Watch live Browserbase session"}
              >
                <Eye className="w-3.5 h-3.5" />
                {showLiveSession ? "Screenshots" : "Watch Live"}
              </button>
              <a
                href={resolvedSessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors"
                title="Open session in Browserbase"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Expand button */}
          {latestScreenshot && !showLiveSession && (
            <button
              onClick={() => setExpandedScreenshot(latestScreenshot)}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Expand screenshot"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Viewport area */}
        <div className="flex-1 relative bg-black min-h-0 group/viewport overflow-hidden">
          {/* Subtle grid pattern overlay for empty/loading states */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[20px_20px] pointer-events-none" />

          {showLiveSession && resolvedSessionUrl ? (
            /* Live Browserbase session embed */
            <div className="absolute inset-0 flex flex-col z-10 bg-black">
              <iframe
                src={resolvedSessionUrl}
                className="flex-1 w-full border-0"
                allow="clipboard-read; clipboard-write"
                title="Browserbase live session"
              />
              {isRunning && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 border border-emerald-500/30 backdrop-blur-md shadow-lg">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-medium uppercase tracking-widest">
                    Live Feed
                  </span>
                </div>
              )}
            </div>
          ) : !task ? (
            /* No session - waiting state with radar scan */
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="relative mb-8">
              {/* Radar animation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border border-emerald-500/10 rounded-full animate-[spin_4s_linear_infinite]" />
                <div className="w-48 h-48 border border-emerald-500/5 rounded-full absolute animate-[spin_8s_linear_infinite_reverse]" />
                <div className="w-full h-1/2 bg-linear-to-t from-emerald-500/10 to-transparent absolute top-0 left-0 origin-bottom animate-[spin_3s_linear_infinite]" 
                     style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} 
                />
                {/* Crosshairs */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-px h-full bg-emerald-500/50"></div>
                    <div className="h-px w-full bg-emerald-500/50"></div>
                </div>
              </div>
              
              <div className="relative z-10 w-16 h-16 rounded-full bg-black/80 flex items-center justify-center border border-emerald-500/20 backdrop-blur-sm shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <Monitor className="w-8 h-8 text-emerald-500/50" />
              </div>
              
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-emerald-500/20 blur-lg rounded-full" />
            </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-zinc-400 font-medium tracking-wide">
                  System Standby
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Awaiting task initialization...</span>
                </div>
              </div>
            </div>
          ) : latestScreenshot ? (
            /* Active session with screenshot */
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-4 z-10">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={`data:image/png;base64,${latestScreenshot}`}
                  alt="Live browser session"
                  className="max-w-full max-h-full object-contain rounded-md shadow-2xl ring-1 ring-white/10"
                  onClick={() => setExpandedScreenshot(latestScreenshot)}
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-md pointer-events-none" />
                
                {/* Overlay details */}
                <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[10px] font-mono text-zinc-400 pointer-events-none">
                  IMG_CAPTURED
                </div>

                {isRunning && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 border border-emerald-500/20 backdrop-blur-md">
                    <div className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-medium uppercase tracking-widest">
                      Live
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Active session but no screenshots yet */
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center animate-pulse">
                  <Globe className="w-8 h-8 text-zinc-700" />
                </div>
                {isRunning && (
                  <div className="absolute -top-1 -right-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm text-zinc-400 font-medium tracking-wide">
                {isRunning ? "Establishing Connection..." : "Session Terminated"}
              </p>
              <p className="text-xs text-zinc-600 font-mono mt-1">
                {isRunning
                  ? "Waiting for video feed"
                  : "No visual data captured"}
              </p>
              {task.id && (
                <div className="mt-4 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono">
                  SID: {task.id.slice(0, 8)}...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            {task ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning
                        ? "bg-emerald-500 animate-pulse shadow-[0_0_4px_currentColor]"
                        : task.status === "success"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className={isRunning ? "text-emerald-400" : ""}>
                    {isRunning ? "CONNECTED" : task.status.toUpperCase()}
                  </span>
                </div>
                <span className="text-zinc-700">|</span>
                <span>SID: {task.id.slice(0, 8)}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                DISCONNECTED
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {task && (
              <>
                <span>{task.steps.length} OPS</span>
                <span>{task.screenshots.length} CAPS</span>
              </>
            )}
            <span className="text-zinc-600">BROWSERBASE • STAGEHAND</span>
          </div>
        </div>
      </div>

      {/* Expanded screenshot modal */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-100 p-8 cursor-pointer backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setExpandedScreenshot(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] group">
            <img
              src={`data:image/png;base64,${expandedScreenshot}`}
              alt="Full screenshot"
              className="max-w-full max-h-full rounded-lg border border-zinc-800 shadow-2xl"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur rounded-full border border-white/10 text-xs text-zinc-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              Click anywhere to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
