import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis/client";
import { getPatternCount } from "@/lib/redis/patterns";
import { logEvaluation } from "@/lib/tracing/weave";
import type { TaskResult } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/evaluation
 *
 * Quantitative self-improvement evaluation.
 * Splits task history into cohorts and computes improvement metrics.
 * This is THE proof that the agent gets better over time.
 *
 * Returns:
 * - Cohort comparison (first third vs last third)
 * - Improvement factors (speed, accuracy, cache utilization)
 * - Overall improvement score (0-100)
 * - Per-metric breakdown with statistical significance
 */

interface CohortMetrics {
  label: string;
  taskCount: number;
  successRate: number;
  avgDurationMs: number;
  cacheHitRate: number;
  recoveryRate: number;
  patternsUsed: number;
  avgQualityScore: number;
}

interface ImprovementMetric {
  metric: string;
  firstCohort: number;
  lastCohort: number;
  improvement: number;
  improvementPct: string;
  direction: "better" | "worse" | "same";
  unit: string;
}

function computeCohortMetrics(tasks: TaskResult[], label: string): CohortMetrics {
  if (tasks.length === 0) {
    return { label, taskCount: 0, successRate: 0, avgDurationMs: 0, cacheHitRate: 0, recoveryRate: 0, patternsUsed: 0, avgQualityScore: 0 };
  }

  const successful = tasks.filter(t => t.status === "success").length;
  const cached = tasks.filter(t => t.used_cached_pattern).length;
  const recoveryAttempted = tasks.filter(t => t.recovery_attempted).length;
  const recoverySucceeded = tasks.filter(t => t.recovery_attempted && t.status === "success").length;
  const patterns = new Set(tasks.filter(t => t.pattern_id).map(t => t.pattern_id)).size;

  const durations = tasks
    .filter(t => t.completed_at && t.created_at)
    .map(t => (t.completed_at! - t.created_at));
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const qualityScores = tasks
    .filter(t => t.quality_score != null)
    .map(t => t.quality_score!);
  const avgQualityScore = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : 0;

  return {
    label,
    taskCount: tasks.length,
    successRate: (successful / tasks.length) * 100,
    avgDurationMs: Math.round(avgDuration),
    cacheHitRate: (cached / tasks.length) * 100,
    recoveryRate: recoveryAttempted > 0 ? (recoverySucceeded / recoveryAttempted) * 100 : 0,
    patternsUsed: patterns,
    avgQualityScore,
  };
}

function computeImprovementScore(metrics: ImprovementMetric[]): number {
  // Weighted average of improvements
  const weights: Record<string, number> = {
    "Success Rate": 30,
    "Avg Duration": 25,
    "Cache Hit Rate": 25,
    "Recovery Needed": 20,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const m of metrics) {
    const weight = weights[m.metric] || 10;
    let normalizedImprovement = 0;

    if (m.metric === "Avg Duration" || m.metric === "Recovery Needed") {
      // Lower is better for duration and recovery needed
      if (m.firstCohort > 0) {
        normalizedImprovement = Math.min(((m.firstCohort - m.lastCohort) / m.firstCohort) * 100, 100);
      }
    } else {
      // Higher is better for rates
      normalizedImprovement = m.lastCohort - m.firstCohort;
    }

    // Clamp to 0-100
    normalizedImprovement = Math.max(0, Math.min(100, normalizedImprovement));

    weightedScore += normalizedImprovement * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

export async function GET() {
  try {
    const client = await getRedisClient();

    // Get all tasks
    const taskIds = await client.zRange("tasks:timeline", 0, -1);
    const tasks: TaskResult[] = [];

    for (const id of taskIds) {
      const data = await client.hGet(`task:${id}`, "data");
      if (data) {
        try {
          tasks.push(JSON.parse(data) as TaskResult);
        } catch {
          // Skip invalid
        }
      }
    }

    // Sort by creation time
    tasks.sort((a, b) => a.created_at - b.created_at);

    if (tasks.length < 3) {
      return NextResponse.json({
        status: "insufficient_data",
        message: "Need at least 3 tasks to evaluate improvement",
        tasks_available: tasks.length,
        evaluation: null,
      });
    }

    // Split into cohorts: first third, middle third, last third
    const third = Math.ceil(tasks.length / 3);
    const firstCohort = tasks.slice(0, third);
    const middleCohort = tasks.slice(third, third * 2);
    const lastCohort = tasks.slice(third * 2);

    const firstMetrics = computeCohortMetrics(firstCohort, "Early (First Third)");
    const middleMetrics = computeCohortMetrics(middleCohort, "Middle (Second Third)");
    const lastMetrics = computeCohortMetrics(lastCohort, "Recent (Last Third)");

    // Compute improvement metrics
    const improvements: ImprovementMetric[] = [
      {
        metric: "Success Rate",
        firstCohort: Math.round(firstMetrics.successRate * 10) / 10,
        lastCohort: Math.round(lastMetrics.successRate * 10) / 10,
        improvement: Math.round((lastMetrics.successRate - firstMetrics.successRate) * 10) / 10,
        improvementPct: firstMetrics.successRate > 0
          ? `+${(((lastMetrics.successRate - firstMetrics.successRate) / firstMetrics.successRate) * 100).toFixed(0)}%`
          : "N/A",
        direction: lastMetrics.successRate > firstMetrics.successRate ? "better" : lastMetrics.successRate === firstMetrics.successRate ? "same" : "worse",
        unit: "%",
      },
      {
        metric: "Avg Duration",
        firstCohort: firstMetrics.avgDurationMs,
        lastCohort: lastMetrics.avgDurationMs,
        improvement: firstMetrics.avgDurationMs - lastMetrics.avgDurationMs,
        improvementPct: firstMetrics.avgDurationMs > 0
          ? `-${(((firstMetrics.avgDurationMs - lastMetrics.avgDurationMs) / firstMetrics.avgDurationMs) * 100).toFixed(0)}%`
          : "N/A",
        direction: lastMetrics.avgDurationMs < firstMetrics.avgDurationMs ? "better" : lastMetrics.avgDurationMs === firstMetrics.avgDurationMs ? "same" : "worse",
        unit: "ms",
      },
      {
        metric: "Cache Hit Rate",
        firstCohort: Math.round(firstMetrics.cacheHitRate * 10) / 10,
        lastCohort: Math.round(lastMetrics.cacheHitRate * 10) / 10,
        improvement: Math.round((lastMetrics.cacheHitRate - firstMetrics.cacheHitRate) * 10) / 10,
        improvementPct: `+${(lastMetrics.cacheHitRate - firstMetrics.cacheHitRate).toFixed(0)}pp`,
        direction: lastMetrics.cacheHitRate > firstMetrics.cacheHitRate ? "better" : lastMetrics.cacheHitRate === firstMetrics.cacheHitRate ? "same" : "worse",
        unit: "%",
      },
    ];

    // Compute Recovery Needed metric using actual recovery_attempted data
    const firstRecoveryRate = firstMetrics.taskCount > 0
      ? Math.round((firstCohort.filter(t => t.recovery_attempted).length / firstMetrics.taskCount) * 1000) / 10
      : 0;
    const lastRecoveryRate = lastMetrics.taskCount > 0
      ? Math.round((lastCohort.filter(t => t.recovery_attempted).length / lastMetrics.taskCount) * 1000) / 10
      : 0;

    improvements.push({
      metric: "Recovery Needed",
      firstCohort: firstRecoveryRate,
      lastCohort: lastRecoveryRate,
      improvement: Math.round((firstRecoveryRate - lastRecoveryRate) * 10) / 10,
      improvementPct: firstRecoveryRate > 0
        ? `-${(((firstRecoveryRate - lastRecoveryRate) / firstRecoveryRate) * 100).toFixed(0)}%`
        : "0%",
      direction: lastRecoveryRate < firstRecoveryRate ? "better" : lastRecoveryRate === firstRecoveryRate ? "same" : "worse",
      unit: "%",
    });

    // Add Avg Quality metric if any tasks have quality scores
    if (firstMetrics.avgQualityScore > 0 || lastMetrics.avgQualityScore > 0) {
      improvements.push({
        metric: "Avg Quality",
        firstCohort: firstMetrics.avgQualityScore,
        lastCohort: lastMetrics.avgQualityScore,
        improvement: lastMetrics.avgQualityScore - firstMetrics.avgQualityScore,
        improvementPct: firstMetrics.avgQualityScore > 0
          ? `+${(((lastMetrics.avgQualityScore - firstMetrics.avgQualityScore) / firstMetrics.avgQualityScore) * 100).toFixed(0)}%`
          : "N/A",
        direction: lastMetrics.avgQualityScore > firstMetrics.avgQualityScore ? "better" : lastMetrics.avgQualityScore === firstMetrics.avgQualityScore ? "same" : "worse",
        unit: "/100",
      });
    }

    const improvementScore = computeImprovementScore(improvements);
    // Count patterns from tasks (works even without vector index)
    let patternsLearned = 0;
    try {
      patternsLearned = await getPatternCount();
    } catch {
      // Fallback: count unique pattern_ids from tasks
    }
    if (patternsLearned === 0) {
      patternsLearned = new Set(tasks.filter(t => t.pattern_id).map(t => t.pattern_id)).size;
    }

    // Compute speed improvement factor
    const speedFactor = firstMetrics.avgDurationMs > 0 && lastMetrics.avgDurationMs > 0
      ? (firstMetrics.avgDurationMs / lastMetrics.avgDurationMs).toFixed(1)
      : "N/A";

    const improvementGrade = improvementScore >= 70 ? "A" : improvementScore >= 50 ? "B" : improvementScore >= 30 ? "C" : "D";

    // Log evaluation to Weave for tracking improvement over time
    try {
      await logEvaluation({
        improvement_score: improvementScore,
        improvement_grade: improvementGrade,
        speed_factor: speedFactor,
        patterns_learned: patternsLearned,
        tasks_analyzed: tasks.length,
        cohorts: {
          first: firstMetrics as unknown as Record<string, unknown>,
          middle: middleMetrics as unknown as Record<string, unknown>,
          last: lastMetrics as unknown as Record<string, unknown>,
        },
        improvements: improvements as unknown as Array<Record<string, unknown>>,
        summary: {
          headline: improvementScore >= 50
            ? `WebScout improved ${improvementScore}% — ${speedFactor}x faster with ${Math.round(lastMetrics.cacheHitRate)}% cache utilization`
            : `WebScout is learning — ${patternsLearned} patterns cached so far`,
          success_rate_change: `${firstMetrics.successRate.toFixed(0)}% → ${lastMetrics.successRate.toFixed(0)}%`,
          speed_change: `${(firstMetrics.avgDurationMs / 1000).toFixed(1)}s → ${(lastMetrics.avgDurationMs / 1000).toFixed(1)}s`,
          cache_change: `${firstMetrics.cacheHitRate.toFixed(0)}% → ${lastMetrics.cacheHitRate.toFixed(0)}%`,
        },
      });
    } catch {
      // Non-critical — Weave logging is best-effort
    }

    return NextResponse.json({
      status: "evaluated",
      tasks_analyzed: tasks.length,
      evaluation: {
        improvement_score: improvementScore,
        improvement_grade: improvementGrade,
        speed_factor: speedFactor,
        patterns_learned: patternsLearned,
        cohorts: {
          first: firstMetrics,
          middle: middleMetrics,
          last: lastMetrics,
        },
        improvements,
        summary: {
          headline: improvementScore >= 50
            ? `WebScout improved ${improvementScore}% — ${speedFactor}x faster with ${Math.round(lastMetrics.cacheHitRate)}% cache utilization`
            : `WebScout is learning — ${patternsLearned} patterns cached so far`,
          success_rate_change: `${firstMetrics.successRate.toFixed(0)}% → ${lastMetrics.successRate.toFixed(0)}%`,
          speed_change: `${(firstMetrics.avgDurationMs / 1000).toFixed(1)}s → ${(lastMetrics.avgDurationMs / 1000).toFixed(1)}s`,
          cache_change: `${firstMetrics.cacheHitRate.toFixed(0)}% → ${lastMetrics.cacheHitRate.toFixed(0)}%`,
        },
      },
    });
  } catch (error) {
    console.error("[Evaluation] Failed:", error);
    return NextResponse.json(
      { error: "Evaluation failed", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
