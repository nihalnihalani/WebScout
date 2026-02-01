import * as weave from "weave";
import { initWeave } from "@/lib/tracing/weave";
import { createTracedOp } from "@/lib/tracing/weave";
import { listTasks } from "@/lib/redis/tasks";
import type { TaskResult } from "@/lib/utils/types";

/**
 * Cohort-level metrics computed from a slice of task history.
 */
interface CohortMetrics {
  label: string;
  task_count: number;
  success_rate: number;
  avg_duration: number;
  cache_hit_rate: number;
  recovery_rate: number;
  avg_quality_score: number;
}

/**
 * Delta between the early and recent cohorts for a single metric.
 */
interface MetricDelta {
  metric: string;
  early: number;
  recent: number;
  delta: number;
  direction: "improved" | "regressed" | "unchanged";
}

/**
 * Full structured result returned by a batch evaluation run.
 */
export interface BatchEvaluationResult {
  status: "evaluated" | "insufficient_data";
  message?: string;
  timestamp: string;
  total_tasks: number;
  cohorts: {
    early: CohortMetrics;
    recent: CohortMetrics;
  };
  deltas: MetricDelta[];
  summary: {
    success_improvement: number;
    speed_improvement: number;
    cache_improvement: number;
    overall_improvement_score: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCohortMetrics(
  tasks: TaskResult[],
  label: string
): CohortMetrics {
  if (tasks.length === 0) {
    return {
      label,
      task_count: 0,
      success_rate: 0,
      avg_duration: 0,
      cache_hit_rate: 0,
      recovery_rate: 0,
      avg_quality_score: 0,
    };
  }

  const successful = tasks.filter((t) => t.status === "success").length;
  const cached = tasks.filter((t) => t.used_cached_pattern).length;
  const recoveryAttempted = tasks.filter((t) => t.recovery_attempted).length;
  const recoverySucceeded = tasks.filter(
    (t) => t.recovery_attempted && t.status === "success"
  ).length;

  const durations = tasks
    .filter((t) => t.completed_at && t.created_at)
    .map((t) => t.completed_at! - t.created_at);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  const qualityScores = tasks
    .filter((t) => typeof t.quality_score === "number")
    .map((t) => t.quality_score!);
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;

  return {
    label,
    task_count: tasks.length,
    success_rate: round((successful / tasks.length) * 100),
    avg_duration: Math.round(avgDuration),
    cache_hit_rate: round((cached / tasks.length) * 100),
    recovery_rate:
      recoveryAttempted > 0
        ? round((recoverySucceeded / recoveryAttempted) * 100)
        : 0,
    avg_quality_score: round(avgQuality),
  };
}

function computeDelta(
  metric: string,
  early: number,
  recent: number,
  lowerIsBetter = false
): MetricDelta {
  const rawDelta = recent - early;
  const delta = round(rawDelta);
  let direction: MetricDelta["direction"] = "unchanged";
  if (Math.abs(rawDelta) > 0.01) {
    if (lowerIsBetter) {
      direction = rawDelta < 0 ? "improved" : "regressed";
    } else {
      direction = rawDelta > 0 ? "improved" : "regressed";
    }
  }
  return { metric, early: round(early), recent: round(recent), delta, direction };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Core batch evaluation logic (pure function, easy to test)
// ---------------------------------------------------------------------------

async function batchEvaluationLogic(): Promise<BatchEvaluationResult> {
  // Fetch all completed tasks (up to 10 000)
  const { tasks: allTasks } = await listTasks(10_000, 0);

  // Keep only completed tasks (success or failed, not pending/running)
  const completedTasks = allTasks
    .filter((t) => t.status === "success" || t.status === "failed")
    .sort((a, b) => a.created_at - b.created_at);

  if (completedTasks.length < 3) {
    return {
      status: "insufficient_data",
      message: `Need at least 3 completed tasks to evaluate. Found ${completedTasks.length}.`,
      timestamp: new Date().toISOString(),
      total_tasks: completedTasks.length,
      cohorts: {
        early: computeCohortMetrics([], "Early"),
        recent: computeCohortMetrics([], "Recent"),
      },
      deltas: [],
      summary: {
        success_improvement: 0,
        speed_improvement: 0,
        cache_improvement: 0,
        overall_improvement_score: 0,
      },
    };
  }

  // Split into thirds; use first and last third for comparison
  const third = Math.ceil(completedTasks.length / 3);
  const earlyTasks = completedTasks.slice(0, third);
  const recentTasks = completedTasks.slice(completedTasks.length - third);

  const early = computeCohortMetrics(earlyTasks, "Early (First Third)");
  const recent = computeCohortMetrics(recentTasks, "Recent (Last Third)");

  // Compute deltas
  const deltas: MetricDelta[] = [
    computeDelta("success_rate", early.success_rate, recent.success_rate),
    computeDelta("avg_duration", early.avg_duration, recent.avg_duration, true),
    computeDelta("cache_hit_rate", early.cache_hit_rate, recent.cache_hit_rate),
    computeDelta("recovery_rate", early.recovery_rate, recent.recovery_rate),
    computeDelta(
      "avg_quality_score",
      early.avg_quality_score,
      recent.avg_quality_score
    ),
  ];

  // Headline summary numbers
  const successImprovement = round(recent.success_rate - early.success_rate);
  const speedImprovement =
    early.avg_duration > 0
      ? round(((early.avg_duration - recent.avg_duration) / early.avg_duration) * 100)
      : 0;
  const cacheImprovement = round(recent.cache_hit_rate - early.cache_hit_rate);

  // Overall weighted score (0-100)
  const weights = { success: 30, speed: 25, cache: 25, quality: 20 };
  const normSuccess = Math.max(0, Math.min(100, successImprovement));
  const normSpeed = Math.max(0, Math.min(100, speedImprovement));
  const normCache = Math.max(0, Math.min(100, cacheImprovement));
  const qualityDelta = recent.avg_quality_score - early.avg_quality_score;
  const normQuality = Math.max(0, Math.min(100, qualityDelta));
  const overallScore = round(
    (normSuccess * weights.success +
      normSpeed * weights.speed +
      normCache * weights.cache +
      normQuality * weights.quality) /
      (weights.success + weights.speed + weights.cache + weights.quality)
  );

  return {
    status: "evaluated",
    timestamp: new Date().toISOString(),
    total_tasks: completedTasks.length,
    cohorts: { early, recent },
    deltas,
    summary: {
      success_improvement: successImprovement,
      speed_improvement: speedImprovement,
      cache_improvement: cacheImprovement,
      overall_improvement_score: Math.max(0, overallScore),
    },
  };
}

// ---------------------------------------------------------------------------
// Exported traced operation
// ---------------------------------------------------------------------------

/**
 * Run a full batch evaluation across all completed tasks.
 * Wrapped with Weave tracing so every run appears in the Weave UI.
 */
export const runBatchEvaluation = createTracedOp(
  "webscout.batch_evaluation",
  batchEvaluationLogic,
  {
    summarize: (result: BatchEvaluationResult) => ({
      "webscout.eval.success_improvement": result.summary.success_improvement,
      "webscout.eval.speed_improvement": result.summary.speed_improvement,
      "webscout.eval.cache_improvement": result.summary.cache_improvement,
      "webscout.eval.overall_score": result.summary.overall_improvement_score,
      "webscout.eval.total_tasks": result.total_tasks,
    }),
    callDisplayName: () =>
      `batch-eval-${new Date().toISOString().slice(0, 10)}`,
  }
);

// ---------------------------------------------------------------------------
// Formal Weave Evaluation with typed scorers
// ---------------------------------------------------------------------------

/**
 * Scorer: Did the task succeed?
 */
const successScorer = weave.op(
  function successScorer({ modelOutput }: { modelOutput: TaskResult }): { score: number } {
    if (!modelOutput) return { score: 0 };
    return { score: modelOutput.status === "success" ? 1.0 : 0.0 };
  },
  { name: "webscout.scorer.success" }
);

/**
 * Scorer: How fast was the task? (normalized 0-1)
 */
const speedScorer = weave.op(
  function speedScorer({ modelOutput }: { modelOutput: TaskResult }): { score: number } {
    if (!modelOutput) return { score: 0 };
    const durationMs = (modelOutput.completed_at || Date.now()) - modelOutput.created_at;
    const seconds = durationMs / 1000;
    if (seconds <= 3) return { score: 1.0 };
    if (seconds >= 60) return { score: 0.0 };
    return { score: Math.max(0, 1.0 - (seconds - 3) / 57) };
  },
  { name: "webscout.scorer.speed" }
);

/**
 * Scorer: Was a cached pattern used?
 */
const cacheScorer = weave.op(
  function cacheScorer({ modelOutput }: { modelOutput: TaskResult }): { score: number } {
    if (!modelOutput) return { score: 0 };
    if (modelOutput.used_cached_pattern) return { score: 1.0 };
    if (modelOutput.recovery_attempted) return { score: 0.25 };
    return { score: 0.5 };
  },
  { name: "webscout.scorer.cache_efficiency" }
);

/**
 * Scorer: Quality of extracted data (from GPT-4o assessment)
 */
const qualityScorer = weave.op(
  function qualityScorer({ modelOutput }: { modelOutput: TaskResult }): { score: number } {
    if (!modelOutput) return { score: 0 };
    return { score: Math.max(0, Math.min(1, (modelOutput.quality_score ?? 0) / 100)) };
  },
  { name: "webscout.scorer.quality" }
);

/**
 * Replay model — receives { datasetRow: { task: TaskResult } } from Weave's Evaluation
 * framework and returns the TaskResult as the "prediction" (model output).
 */
const replayModel = weave.op(
  async function replayModel({ datasetRow }: { datasetRow: { task: TaskResult } }): Promise<TaskResult> {
    return datasetRow.task;
  },
  { name: "webscout.replay_model" }
);

export interface WeaveEvaluationResult {
  status: "evaluated" | "insufficient_data";
  message?: string;
  total_tasks: number;
  scores: {
    success: number;
    speed: number;
    cache_efficiency: number;
    quality: number;
    overall: number;
  };
}

/**
 * Run a formal Weave Evaluation using the Evaluation class.
 * This creates a proper entry in Weave's Evaluation UI with scorers.
 */
export async function runWeaveEvaluation(): Promise<WeaveEvaluationResult> {
  await initWeave();

  const { tasks: allTasks } = await listTasks(10_000, 0);
  const completedTasks = allTasks
    .filter((t) => t.status === "success" || t.status === "failed")
    .sort((a, b) => a.created_at - b.created_at);

  if (completedTasks.length < 2) {
    return {
      status: "insufficient_data",
      message: `Need at least 2 completed tasks. Found ${completedTasks.length}.`,
      total_tasks: completedTasks.length,
      scores: { success: 0, speed: 0, cache_efficiency: 0, quality: 0, overall: 0 },
    };
  }

  // Build dataset rows — each row wraps a TaskResult
  const rows = completedTasks.map((t) => ({ task: t }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const EvaluationClass = (weave as any).Evaluation;
    if (!EvaluationClass) {
      // Fallback: compute scores manually if Evaluation class is unavailable
      return computeScoresManually(completedTasks);
    }

    const evaluation = new EvaluationClass({
      dataset: rows,
      scorers: [successScorer, speedScorer, cacheScorer, qualityScorer],
    });

    const evalResult = await evaluation.evaluate({ model: replayModel });

    // Extract average scores from evaluation result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores = extractScoresFromResult(evalResult as any, completedTasks);

    return {
      status: "evaluated",
      total_tasks: completedTasks.length,
      scores,
    };
  } catch (error) {
    console.warn("[WeaveEval] Evaluation class failed, falling back:", (error as Error).message);
    return computeScoresManually(completedTasks);
  }
}

function computeScoresManually(tasks: TaskResult[]): WeaveEvaluationResult {
  const successAvg = tasks.filter(t => t.status === "success").length / tasks.length;
  const speeds = tasks.map(t => {
    const dur = ((t.completed_at || Date.now()) - t.created_at) / 1000;
    if (dur <= 3) return 1.0;
    if (dur >= 60) return 0.0;
    return Math.max(0, 1.0 - (dur - 3) / 57);
  });
  const speedAvg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const cacheAvg = tasks.map(t => t.used_cached_pattern ? 1.0 : (t.recovery_attempted ? 0.25 : 0.5)).reduce((a, b) => a + b, 0) / tasks.length;
  const qualityAvg = tasks.filter(t => typeof t.quality_score === "number").map(t => Math.min(1, t.quality_score! / 100));
  const qualityScore = qualityAvg.length > 0 ? qualityAvg.reduce((a, b) => a + b, 0) / qualityAvg.length : 0;
  const overall = (successAvg * 0.3 + speedAvg * 0.25 + cacheAvg * 0.25 + qualityScore * 0.2);

  return {
    status: "evaluated",
    total_tasks: tasks.length,
    scores: {
      success: round(successAvg),
      speed: round(speedAvg),
      cache_efficiency: round(cacheAvg),
      quality: round(qualityScore),
      overall: round(overall),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScoresFromResult(evalResult: any, tasks: TaskResult[]): WeaveEvaluationResult["scores"] {
  try {
    // Weave Evaluation returns results with scorer summaries
    const successScore = evalResult?.successScorer?.score?.mean ?? evalResult?.["webscout.scorer.success"]?.score?.mean;
    const speedScore = evalResult?.speedScorer?.score?.mean ?? evalResult?.["webscout.scorer.speed"]?.score?.mean;
    const cacheScore = evalResult?.cacheScorer?.score?.mean ?? evalResult?.["webscout.scorer.cache_efficiency"]?.score?.mean;
    const qualityScore = evalResult?.qualityScorer?.score?.mean ?? evalResult?.["webscout.scorer.quality"]?.score?.mean;

    if (successScore != null) {
      const overall = (successScore * 0.3 + (speedScore ?? 0) * 0.25 + (cacheScore ?? 0) * 0.25 + (qualityScore ?? 0) * 0.2);
      return {
        success: round(successScore),
        speed: round(speedScore ?? 0),
        cache_efficiency: round(cacheScore ?? 0),
        quality: round(qualityScore ?? 0),
        overall: round(overall),
      };
    }
  } catch {
    // Fall through to manual computation
  }

  // Fallback
  const manual = computeScoresManually(tasks);
  return manual.scores;
}
