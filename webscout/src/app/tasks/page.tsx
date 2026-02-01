"use client";

import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/task-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function TasksPage() {
  const { data, isLoading } = useTasks();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">All Tasks</h2>
        <p className="text-zinc-500 mt-1">
          {data?.total || 0} total tasks executed
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : data?.tasks && data.tasks.length > 0 ? (
        <TaskList tasks={data.tasks} />
      ) : (
        <EmptyState
          icon={Inbox}
          title="No tasks yet"
          description="Run your first extraction task to see results here."
          action={
            <Link
              href="/"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Go to Dashboard
            </Link>
          }
          className="bg-zinc-900 border-zinc-800"
        />
      )}
    </div>
  );
}
