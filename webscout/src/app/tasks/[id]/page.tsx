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
      <Link
        href="/tasks"
        className="text-sm text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to tasks
      </Link>

      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-sm text-zinc-400 font-mono truncate">
                {task.url}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-zinc-500 shrink-0" />
              <span className="text-lg text-white font-medium">
                {task.target}
              </span>
            </div>
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
