import type { PagePattern } from "../utils/types";

const HALF_LIFE_DAYS = 30;
const RECENCY_BONUS_WEIGHT = 0.15;

/**
 * Compute pattern fitness using Wilson score lower bound + time decay.
 * Returns 0-1 score combining reliability and freshness.
 *
 * Wilson score lower bound gives a conservative estimate of the true
 * success probability, penalizing patterns with few observations.
 * Time decay ensures stale patterns gradually lose priority.
 *
 * NOTE: This is a pure synchronous math function — NOT a traced op.
 * It's called inside .map() in the scraper's pattern ranking pipeline,
 * so it must return a number directly, not a Promise.
 */
export function computePatternFitness(pattern: PagePattern): number {
  const total = pattern.success_count + pattern.failure_count;
  if (total === 0) return 0.5; // Unknown pattern, neutral score

  // Wilson score lower bound (95% confidence)
  const p = pattern.success_count / total;
  const z = 1.96; // 95% CI
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  const rawWilsonLower = (center - spread) / denominator;

  // Blend Wilson with raw success rate for low-observation patterns.
  // Wilson is too conservative with few observations (1 success → 0.21),
  // making it impossible for new patterns to ever hit cache. We linearly
  // blend toward the raw rate as observations increase.
  const blendThreshold = 5;
  const blendFactor = Math.min(total / blendThreshold, 1);
  const wilsonLower = blendFactor * rawWilsonLower + (1 - blendFactor) * p;

  // Exponential time decay (30-day half-life)
  const now = Date.now();
  const lastActivity = pattern.last_succeeded_at || pattern.last_failed_at || pattern.created_at;
  const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
  const decay = Math.pow(0.5, daysSinceActivity / HALF_LIFE_DAYS);

  // Recency bonus: recently successful patterns get a small boost
  let recencyBonus = 0;
  if (pattern.last_succeeded_at) {
    const daysSinceSuccess = (now - pattern.last_succeeded_at) / (1000 * 60 * 60 * 24);
    if (daysSinceSuccess < 1) recencyBonus = RECENCY_BONUS_WEIGHT;
    else if (daysSinceSuccess < 7) recencyBonus = RECENCY_BONUS_WEIGHT * 0.5;
  }

  // Final fitness: Wilson * decay + recency bonus, clamped to [0, 1]
  return Math.min(1, Math.max(0, wilsonLower * decay + recencyBonus));
}

/**
 * Re-rank patterns by combining vector similarity score with fitness.
 * vectorWeight + fitnessWeight should equal 1.0.
 */
export function computeCompositeScore(
  vectorScore: number,
  fitness: number,
  vectorWeight: number = 0.6,
  fitnessWeight: number = 0.4
): number {
  return vectorScore * vectorWeight + fitness * fitnessWeight;
}
