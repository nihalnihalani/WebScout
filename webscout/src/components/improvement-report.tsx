"use client";

import { useEvaluation } from "@/hooks/use-evaluation";
import type { ImprovementMetric } from "@/hooks/use-evaluation";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Zap,
  Clock,
  Target,
  RefreshCw,
  Brain,
  ArrowRight,
  BarChart3,
} from "lucide-react";

function MetricIcon({ metric }: { metric: string }) {
  switch (metric) {
    case "Success Rate": return <Target className="w-4 h-4" />;
    case "Avg Duration": return <Clock className="w-4 h-4" />;
    case "Cache Hit Rate": return <Zap className="w-4 h-4" />;
    case "Recovery Rate": return <RefreshCw className="w-4 h-4" />;
    case "Recovery Needed": return <RefreshCw className="w-4 h-4" />;
    default: return <BarChart3 className="w-4 h-4" />;
  }
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "better") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (direction === "worse") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-zinc-500" />;
}

function formatValue(value: number, unit: string, metric: string): string {
  if (metric === "Avg Duration") {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${value.toFixed(1)}${unit}`;
}

function GradeRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#3b82f6" : score >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{grade}</span>
        <span className="text-xs text-zinc-500">{score}/100</span>
      </div>
    </div>
  );
}

function ImprovementRow({ metric }: { metric: ImprovementMetric }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <MetricIcon metric={metric.metric} />
        <span className="text-sm text-zinc-300">{metric.metric}</span>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm font-mono text-zinc-500 w-20 text-right">
          {formatValue(metric.firstCohort, metric.unit, metric.metric)}
        </span>
        <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
        <span className={`text-sm font-mono font-semibold w-20 ${
          metric.direction === "better" ? "text-emerald-400" :
          metric.direction === "worse" ? "text-red-400" : "text-zinc-400"
        }`}>
          {formatValue(metric.lastCohort, metric.unit, metric.metric)}
        </span>
      </div>

      <div className="flex items-center gap-2 w-28 justify-end">
        <DirectionIcon direction={metric.direction} />
        <span className={`text-sm font-semibold ${
          metric.direction === "better" ? "text-emerald-400" :
          metric.direction === "worse" ? "text-red-400" : "text-zinc-500"
        }`}>
          {metric.improvementPct}
        </span>
      </div>
    </div>
  );
}

export function ImprovementReport() {
  const { data, isLoading, error } = useEvaluation();

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <Skeleton className="h-6 w-64 bg-zinc-800 mb-4" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <p className="text-red-400 text-sm">Failed to load evaluation: {error.message}</p>
      </Card>
    );
  }

  if (!data?.evaluation) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Award className="h-8 w-8 text-zinc-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Not Enough Data Yet
          </h3>
          <p className="max-w-sm text-sm text-zinc-500">
            {data?.message || "Run at least 3 tasks to generate an improvement evaluation"}
          </p>
        </div>
      </Card>
    );
  }

  const { evaluation } = data;

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Award className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Self-Improvement Evaluation</h2>
        <span className="ml-2 text-xs text-zinc-500">
          Based on {data.tasks_analyzed} tasks
        </span>
      </div>

      {/* Top section: Score ring + headline + speed factor */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
        <GradeRing score={evaluation.improvement_score} grade={evaluation.improvement_grade} />

        <div className="flex-1 text-center md:text-left">
          <p className="text-base text-zinc-300 mb-4 leading-relaxed">
            {evaluation.summary.headline}
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-lg font-bold">{evaluation.speed_factor}x</span>
              </div>
              <span className="text-xs text-zinc-500">Faster</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <Target className="w-3.5 h-3.5" />
                <span className="text-lg font-bold">{evaluation.summary.success_rate_change}</span>
              </div>
              <span className="text-xs text-zinc-500">Success Rate</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                <Brain className="w-3.5 h-3.5" />
                <span className="text-lg font-bold">{evaluation.patterns_learned}</span>
              </div>
              <span className="text-xs text-zinc-500">Patterns</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed metrics comparison: First cohort → Last cohort */}
      <div className="border-t border-zinc-800 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-400">
            Early Tasks vs Recent Tasks
          </span>
        </div>

        <div>
          {evaluation.improvements.map((metric) => (
            <ImprovementRow key={metric.metric} metric={metric} />
          ))}
        </div>
      </div>

      {/* Cohort breakdown */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        {[evaluation.cohorts.first, evaluation.cohorts.middle, evaluation.cohorts.last].map((cohort) => (
          <div key={cohort.label} className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
            <p className="text-xs font-medium text-zinc-400 mb-2">{cohort.label}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tasks</span>
                <span className="text-zinc-300">{cohort.taskCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Success</span>
                <span className="text-zinc-300">{cohort.successRate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Avg Time</span>
                <span className="text-zinc-300">{(cohort.avgDurationMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Cache Hits</span>
                <span className="text-zinc-300">{cohort.cacheHitRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
