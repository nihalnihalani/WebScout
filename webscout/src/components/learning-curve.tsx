"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useMetrics } from "@/hooks/use-metrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Sparkles, Clock, Zap, Brain } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-2 text-sm font-medium text-white">Task #{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-400">{entry.name}:</span>
          <span className="font-medium text-white">
            {entry.name === "Duration (ms)"
              ? `${entry.value.toLocaleString()} ms`
              : `${entry.value.toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LearningCurve() {
  const { data, isLoading, error } = useMetrics();

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 bg-zinc-800" />
          <Skeleton className="h-[300px] w-full bg-zinc-800" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20 bg-zinc-800" />
            <Skeleton className="h-20 bg-zinc-800" />
            <Skeleton className="h-20 bg-zinc-800" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <p className="text-red-400 text-sm">
          Failed to load metrics: {error.message}
        </p>
      </Card>
    );
  }

  const timeline = data?.timeline ?? [];
  const summary = data?.summary;

  // Empty state
  if (timeline.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Brain className="h-8 w-8 text-zinc-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            No Learning Data Yet
          </h3>
          <p className="max-w-sm text-sm text-zinc-500">
            Run your first task to start seeing the learning curve
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Learning Curve</h2>
            {summary && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                <Sparkles className="h-3 w-3" />
                Generation {summary.generation}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Watch WebScout get smarter over time
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="taskNumber"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              stroke="#3f3f46"
              label={{
                value: "Task #",
                position: "insideBottom",
                offset: -5,
                fill: "#71717a",
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              stroke="#3f3f46"
              domain={[0, 100]}
              label={{
                value: "Rate (%)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                fill: "#71717a",
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              stroke="#3f3f46"
              label={{
                value: "Duration (ms)",
                angle: 90,
                position: "insideRight",
                offset: 10,
                fill: "#71717a",
                fontSize: 11,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 12, color: "#a1a1aa" }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="cacheHitRate"
              name="Cache Hit Rate (%)"
              fill="#10b981"
              fillOpacity={0.3}
              stroke="#10b981"
              strokeWidth={2}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="successRate"
              name="Success Rate (%)"
              fill="#3b82f6"
              fillOpacity={0.2}
              stroke="#3b82f6"
              strokeWidth={2}
            />
            <Bar
              yAxisId="right"
              dataKey="durationMs"
              name="Duration (ms)"
              fill="#f59e0b"
              fillOpacity={0.6}
              barSize={20}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-zinc-500">Avg Duration</span>
            </div>
            <p className="mt-1 text-xl font-bold text-white">
              {(summary.avgDuration / 1000).toFixed(1)}s
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-500">Cache Hit Rate</span>
            </div>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.currentCacheHitRate}%
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-zinc-500">Patterns Learned</span>
            </div>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.patternsLearned}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
