"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LiveSessionViewer } from "@/components/live-session-viewer";
import { ExecutionLog } from "@/components/execution-log";
import { useTaskStream } from "@/hooks/use-task-stream";
import {
  Play,
  Loader2,
  Clock,
  Radio,
  CircleDot,
  MonitorPlay,
} from "lucide-react";

export default function LiveViewPage() {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const { task, isRunning, error: taskError } = useTaskStream(activeTaskId);

  // Duration timer
  useEffect(() => {
    if (!isRunning || !task) {
      return;
    }

    const startTime = task.created_at;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, task]);

  // Stop timer when task completes
  useEffect(() => {
    if (task && !isRunning && task.completed_at) {
      setElapsed(
        Math.floor((task.completed_at - task.created_at) / 1000)
      );
    }
  }, [task, isRunning]);

  const handleRunTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url || !target) return;

      setSubmitting(true);
      setSubmitError(null);
      setElapsed(0);

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, target }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to start task");
        }

        const data = await res.json();
        setActiveTaskId(data.id);
      } catch (err) {
        setSubmitError((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [url, target]
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MonitorPlay className="w-6 h-6 text-emerald-500" />
            Live View
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Watch WebScout navigate, extract, and learn in real-time
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3">
          {task && (
            <>
              {/* Duration */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">
                  {formatDuration(elapsed)}
                </span>
              </div>

              {/* Session ID */}
              <Badge
                variant="outline"
                className="text-xs text-zinc-500 border-zinc-700 font-mono"
              >
                {task.id.slice(0, 8)}
              </Badge>
            </>
          )}

          {/* Connection status */}
          <Badge
            variant="outline"
            className={
              isRunning
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : task
                ? "text-zinc-400 border-zinc-700"
                : "text-zinc-600 border-zinc-800"
            }
          >
            {isRunning ? (
              <>
                <Radio className="w-3 h-3 animate-pulse" />
                Connected
              </>
            ) : task ? (
              <>
                <CircleDot className="w-3 h-3" />
                Complete
              </>
            ) : (
              <>
                <CircleDot className="w-3 h-3" />
                Disconnected
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Task input bar */}
      <Card className="bg-zinc-900 border-zinc-800 p-4 shrink-0">
        <form onSubmit={handleRunTask} className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-zinc-500 mb-1 block">URL</label>
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={submitting || isRunning}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs text-zinc-500 mb-1 block">
              Extraction Target
            </label>
            <Input
              type="text"
              placeholder='e.g., "product title and price"'
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              disabled={submitting || isRunning}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting || isRunning}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-6 shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Task
              </>
            )}
          </Button>
        </form>

        {submitError && (
          <div className="mt-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{submitError}</p>
          </div>
        )}

        {taskError && (
          <div className="mt-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              Polling error: {taskError}
            </p>
          </div>
        )}

        {/* Quick examples */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-zinc-600">Quick:</span>
          <button
            type="button"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800"
            disabled={submitting || isRunning}
            onClick={() => {
              setUrl(
                "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
              );
              setTarget("book title and price");
            }}
          >
            books.toscrape.com
          </button>
          <button
            type="button"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800"
            disabled={submitting || isRunning}
            onClick={() => {
              setUrl("https://quotes.toscrape.com/");
              setTarget("first quote text and author");
            }}
          >
            quotes.toscrape.com
          </button>
          <button
            type="button"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800"
            disabled={submitting || isRunning}
            onClick={() => {
              setUrl("https://news.ycombinator.com");
              setTarget("top 3 story titles");
            }}
          >
            news.ycombinator.com
          </button>
          <button
            type="button"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800"
            disabled={submitting || isRunning}
            onClick={() => {
              setUrl("https://github.com/trending");
              setTarget("top trending repository name and description");
            }}
          >
            github.com/trending
          </button>
          <button
            type="button"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800"
            disabled={submitting || isRunning}
            onClick={() => {
              setUrl("https://example.com");
              setTarget("main heading text");
            }}
          >
            example.com
          </button>
        </div>
      </Card>

      {/* Split pane: Browser view + Execution log */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* LEFT: Browser session viewer */}
        <div className="min-h-[300px] lg:min-h-0">
          <LiveSessionViewer task={task} isRunning={isRunning} sessionUrl={task?.session_url} />
        </div>

        {/* RIGHT: Execution log */}
        <div className="min-h-[300px] lg:min-h-0">
          <ExecutionLog
            steps={task?.steps ?? []}
            isRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
}
