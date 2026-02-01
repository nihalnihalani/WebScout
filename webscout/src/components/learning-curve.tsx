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
    <div className="rounded-lg border border-emerald-500/20 bg-zinc-950/90 backdrop-blur-xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] ring-1 ring-white/5">
      <p className="mb-2 text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Task #{label}
      </p>
      <div className="space-y-2">
        {payload.map(
          (entry: { name: string; value: number; color: string }, i: number) => (
            <div key={i} className="flex items-center justify-between gap-6 text-xs group">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-transform group-hover:scale-125"
                  style={{ backgroundColor: entry.color, color: entry.color }}
                />
                <span className="text-zinc-400 font-medium group-hover:text-zinc-200 transition-colors">{entry.name}</span>
              </div>
              <span className="font-mono text-white font-semibold">
                {entry.name === "Duration (ms)"
                  ? `${entry.value.toLocaleString()} ms`
                  : `${entry.value.toFixed(1)}%`}
              </span>
            </div>
          )
        )}
      </div>
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
      <Card className="bg-zinc-900/50 border-zinc-800 p-6 backdrop-blur-sm relative overflow-hidden group">
        {/* Holographic background effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05),transparent_70%)] animate-pulse-slow" />
        
        <div className="flex flex-col items-center justify-center py-24 text-center relative z-10">
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse-slow" />
            <div className="relative w-20 h-20 rounded-full bg-zinc-950/80 border border-emerald-500/30 flex items-center justify-center backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <Brain className="h-10 w-10 text-emerald-400 animate-[pulse_3s_ease-in-out_infinite]" />
              
              {/* Orbital rings */}
              <div className="absolute inset-0 border border-emerald-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute -inset-2 border border-emerald-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            </div>
            
            {/* Connection lines */}
            <div className="absolute top-1/2 left-full w-12 h-px bg-linear-to-r from-emerald-500/50 to-transparent" />
            <div className="absolute top-1/2 right-full w-12 h-px bg-linear-to-l from-emerald-500/50 to-transparent" />
          </div>
          
          <h3 className="mb-3 text-lg font-semibold text-white tracking-tight">
            Awaiting Neural Training Data
          </h3>
          <p className="max-w-sm text-sm text-zinc-400 leading-relaxed">
            Initialize the first scraping sequence to begin generating learning curve analytics and performance metrics.
          </p>
          
          <div className="mt-8 flex items-center gap-2 text-xs text-emerald-500/70 font-mono bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM_READY_FOR_INPUT
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 p-6 backdrop-blur-sm shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      
      {/* Header */}
      <div className="mb-8 flex items-center justify-between relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Learning Velocity
                </h2>
                {summary && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 uppercase tracking-wide shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <Sparkles className="h-3 w-3" />
                    Gen {summary.generation}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Real-time performance optimization metrics
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="mb-8 relative z-10">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={timeline}>
            <defs>
              <linearGradient id="colorCache" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />
            <XAxis
              dataKey="taskNumber"
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
              stroke="rgba(255,255,255,0.05)"
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
              stroke="rgba(255,255,255,0.05)"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
              stroke="rgba(255,255,255,0.05)"
              tickLine={false}
              axisLine={false}
              dx={10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <Legend
              wrapperStyle={{ paddingTop: 20, fontSize: 11, fontFamily: "monospace", color: "#a1a1aa" }}
              iconType="circle"
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="cacheHitRate"
              name="Cache Hit (%)"
              fill="url(#colorCache)"
              stroke="#10b981"
              strokeWidth={2}
              animationDuration={1500}
              dot={{ fill: "#10b981", strokeWidth: 0, r: 2, fillOpacity: 1 }}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981", filter: "drop-shadow(0 0 4px #10b981)" }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="successRate"
              name="Success (%)"
              fill="url(#colorSuccess)"
              stroke="#8b5cf6"
              strokeWidth={2}
              animationDuration={1500}
              dot={{ fill: "#8b5cf6", strokeWidth: 0, r: 2, fillOpacity: 1 }}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#8b5cf6", filter: "drop-shadow(0 0 4px #8b5cf6)" }}
            />
            <Bar
              yAxisId="right"
              dataKey="durationMs"
              name="Duration (ms)"
              fill="#3b82f6"
              fillOpacity={0.3}
              barSize={4}
              radius={[2, 2, 0, 0]}
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 relative z-10">
          <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-default backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium group-hover:text-blue-400 transition-colors">
                Latency
              </span>
            </div>
            <p className="text-2xl font-bold text-white group-hover:text-blue-300 transition-colors shadow-blue-500/20">
              {(summary.avgDuration / 1000).toFixed(1)}
              <span className="text-sm font-normal text-zinc-600 ml-1">s</span>
            </p>
          </div>

          <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all cursor-default backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium group-hover:text-emerald-400 transition-colors">
                Efficiency
              </span>
            </div>
            <p className="text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
              {summary.currentCacheHitRate}
              <span className="text-sm font-normal text-zinc-600 ml-1">%</span>
            </p>
          </div>

          <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all cursor-default backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium group-hover:text-violet-400 transition-colors">
                Knowledge
              </span>
            </div>
            <p className="text-2xl font-bold text-white group-hover:text-violet-300 transition-colors">
              {summary.patternsLearned}
              <span className="text-sm font-normal text-zinc-600 ml-1">
                patterns
              </span>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
