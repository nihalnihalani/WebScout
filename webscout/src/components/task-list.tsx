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
