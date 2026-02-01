import { createTracedOp } from "../tracing/weave";

// Scorer definitions — each one maps to a column in Weave's Evaluation UI
const SCORERS = ["success", "quality", "speed", "cache_efficiency"] as const;
type ScorerName = (typeof SCORERS)[number];

interface TaskPrediction {
  taskId: string;
  url: string;
  target: string;
  status: "success" | "failed";
  durationMs: number;
  usedCache: boolean;
  recoveryAttempted: boolean;
  qualityScore: number;
  patternFitness?: number;
}

/**
 * Log a completed task as a scored evaluation prediction in Weave.
 * Each call adds a row to the evaluation view with 4 scored dimensions.
 */
export const logTaskAsEvalPrediction = createTracedOp(
  "webscout.evalPrediction",
  async function logTaskAsEvalPrediction(prediction: TaskPrediction): Promise<{
    scores: Record<ScorerName, number>;
    prediction: TaskPrediction;
  }> {
    // Compute scores for each dimension
    const scores: Record<ScorerName, number> = {
      success: prediction.status === "success" ? 1.0 : 0.0,
      quality: Math.max(0, Math.min(1, prediction.qualityScore / 100)),
      speed: computeSpeedScore(prediction.durationMs),
      cache_efficiency: prediction.usedCache ? 1.0 : (prediction.recoveryAttempted ? 0.25 : 0.5),
    };

    return { scores, prediction };
  },
  {
    summarize: (result) => ({
      "webscout.eval.success_score": result.scores.success,
      "webscout.eval.quality_score": result.scores.quality,
      "webscout.eval.speed_score": result.scores.speed,
      "webscout.eval.cache_score": result.scores.cache_efficiency,
      "webscout.eval.task_url": result.prediction.url,
    }),
    callDisplayName: (prediction: TaskPrediction) => {
      try {
        return `eval:${new URL(prediction.url).hostname}/${prediction.target.substring(0, 20)}`;
      } catch {
        return `eval:${prediction.taskId.substring(0, 8)}`;
      }
    },
  }
);

/**
 * Speed score: 1.0 for < 3s, scales linearly to 0.0 at 60s+
 */
function computeSpeedScore(durationMs: number): number {
  const seconds = durationMs / 1000;
  if (seconds <= 3) return 1.0;
  if (seconds >= 60) return 0.0;
  return Math.max(0, 1.0 - (seconds - 3) / 57);
}
