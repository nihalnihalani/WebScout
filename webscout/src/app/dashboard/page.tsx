"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useMetrics } from "@/hooks/use-metrics";
import { StatsOverview } from "@/components/stats-overview";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { LearningCurve } from "@/components/learning-curve";
import { Skeleton } from "@/components/ui/skeleton";

const defaultStats = {
  total: 0,
  successful: 0,
  failed: 0,
  cached: 0,
  recovered: 0,
  patterns_learned: 0,
  cache_hit_rate: "0%",
  recovery_rate: "N/A",
};

export default function DashboardPage() {
  const { data, isLoading, mutate } = useTasks();
  const { data: metricsData } = useMetrics();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-zinc-500 mt-1">
          Monitor WebScout&apos;s learning progress and run new tasks
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : (
        <StatsOverview
          stats={data?.stats || defaultStats}
          generation={metricsData?.summary?.generation}
        />
      )}

      {/* Learning Curve Chart — THE key visual for judges */}
      <LearningCurve />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskForm onTaskComplete={() => mutate()} />

        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent Tasks
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-zinc-900 rounded-lg" />
              ))}
            </div>
          ) : (
            <TaskList tasks={data?.tasks?.slice(0, 5) || []} />
          )}
        </div>
      </div>
    </div>
  );
}
