import type { PatternData } from "../utils/types";
import { extractUrlPattern } from "../utils/url";
import { getRedisClient } from "../redis/client";

const THRESHOLD_KEY = "webscout:confidence_threshold";
const DEFAULT_THRESHOLD = 0.85;
const MIN_THRESHOLD = 0.70;
const MAX_THRESHOLD = 0.95;

// Success lowers threshold slightly (agent is learning), failure raises it (be more cautious)
const SUCCESS_ADJUSTMENT = -0.005;
const FAILURE_ADJUSTMENT = 0.02;

export function buildPattern(
  url: string,
  target: string,
  workingSelector: string,
  approach: "extract" | "act" | "agent"
): PatternData {
  return {
    url_pattern: extractUrlPattern(url),
    target,
    working_selector: workingSelector,
    approach,
  };
}

/**
 * Get the current dynamic confidence threshold from Redis.
 * Defaults to 0.85 if not set.
 */
export async function getConfidenceThreshold(): Promise<number> {
  try {
    const client = await getRedisClient();
    const val = await client.get(THRESHOLD_KEY);
    if (val) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= MIN_THRESHOLD && parsed <= MAX_THRESHOLD) {
        return parsed;
      }
    }
  } catch {
    // Redis unavailable — use default
  }
  return DEFAULT_THRESHOLD;
}

/**
 * Adjust the confidence threshold after a cached extraction attempt.
 * Lowers by 0.005 on success (agent is confident), raises by 0.02 on failure (be more careful).
 * Clamped to [0.70, 0.95].
 */
export async function adjustConfidenceThreshold(wasSuccessful: boolean): Promise<number> {
  try {
    const client = await getRedisClient();
    const current = await getConfidenceThreshold();
    const adjustment = wasSuccessful ? SUCCESS_ADJUSTMENT : FAILURE_ADJUSTMENT;
    const newThreshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, current + adjustment));
    await client.set(THRESHOLD_KEY, newThreshold.toString());
    console.log(
      `[Threshold] ${wasSuccessful ? "Success" : "Failure"}: ${current.toFixed(3)} → ${newThreshold.toFixed(3)}`
    );
    return newThreshold;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

/**
 * Check if a score is a confident match using the provided threshold.
 * If no threshold is provided, uses the default (0.85).
 */
export function isConfidentMatch(score: number, threshold?: number): boolean {
  return score >= (threshold ?? DEFAULT_THRESHOLD);
}

export function buildRefinedInstruction(
  originalTarget: string,
  failureContext: string
): string {
  return (
    `Previous attempt to extract "${originalTarget}" failed. ` +
    `Context: ${failureContext}. ` +
    `Look more carefully: main content, sidebars, tables, product details, ` +
    `pricing sections, metadata. Extract: ${originalTarget}`
  );
}
