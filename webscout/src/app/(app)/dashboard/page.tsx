"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useMetrics } from "@/hooks/use-metrics";
import { StatsOverview } from "@/components/stats-overview";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { LearningCurve } from "@/components/learning-curve";
import { ImprovementReport } from "@/components/improvement-report";
import { LearningTimeline } from "@/components/learning-timeline";
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
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden rounded-3xl bg-zinc-900 border border-white/5 px-6 py-12 sm:px-12 xl:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.zinc.800),theme(colors.zinc.950))] opacity-20" />
        <div className="absolute inset-y-0 right-0 -z-10 w-[200%] origin-bottom-left skew-x-[-30deg] bg-white/5 shadow-xl shadow-emerald-600/10 ring-1 ring-white/10 sm:w-[100%]" />
        
        <div className="mx-auto max-w-2xl lg:mx-0">
          <div className="flex items-center gap-x-3 mb-6">
            <div className="flex-none rounded-full bg-emerald-500/10 p-1 text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              System Online
            </h2>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-4">
            WebScout Dashboard
          </h1>
          <p className="text-lg leading-8 text-zinc-400 max-w-xl">
            Autonomous web extraction engine with self-healing capabilities.
            Monitor learning progress, execute tasks, and analyze pattern recovery in real-time.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-zinc-900/50 rounded-xl border border-white/5" />
          ))}
        </div>
      ) : (
        <StatsOverview
          stats={data?.stats || defaultStats}
          generation={metricsData?.summary?.generation}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Forms & Charts */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LearningCurve />
            <ImprovementReport />
          </div>
          
          <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
             <div className="mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                Execute New Task
              </h3>
              <p className="text-sm text-zinc-500 mt-1 ml-3">
                Dispatch a new extraction job to the swarm
              </p>
            </div>
            <TaskForm onTaskComplete={() => mutate()} />
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full" />
              Recent Tasks
            </h3>
            <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Live Feed</span>
          </div>
          
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 bg-zinc-900/50 rounded-xl border border-white/5" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <TaskList tasks={data?.tasks?.slice(0, 5) || []} />
            </div>
          )}
        </div>
      </div>

      {/* Learning Timeline - full width */}
      <div className="pt-8 border-t border-white/5">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
           <span className="w-1 h-4 bg-purple-500 rounded-full" />
           System Evolution Timeline
        </h3>
        <LearningTimeline />
      </div>
    </div>
  );
}
