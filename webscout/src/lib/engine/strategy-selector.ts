import { getRedisClient } from "../redis/client";
import { createTracedOp } from "../tracing/weave";

interface StrategyStats {
  strategy: string;
  attempts: number;
  successes: number;
  avgDurationMs: number;
  successRate: number;
}

const STRATEGY_PREFIX = "strategy_stats:";
const ALL_STRATEGIES = ["agent", "act", "extract_refined", "gemini"];

/**
 * Record the outcome of a recovery strategy attempt.
 * Stored per URL-pattern so the agent learns domain-specific preferences.
 */
export const recordStrategyOutcome = createTracedOp(
  "recordStrategyOutcome",
  async function recordStrategyOutcome(
    urlPattern: string,
    strategy: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    const client = await getRedisClient();
    const key = `${STRATEGY_PREFIX}${urlPattern}:${strategy}`;

    // Increment counts first, then update running average using the committed values
    await Promise.all([
      client.hIncrBy(key, "attempts", 1),
      ...(success ? [client.hIncrBy(key, "successes", 1)] : []),
    ]);

    // Running average: new_avg = old_avg + (new_value - old_avg) / count
    const data = await client.hGetAll(key);
    const attempts = parseInt(data.attempts || "1", 10);
    const oldAvg = parseFloat(data.avg_duration_ms || "0");
    const newAvg = oldAvg + (durationMs - oldAvg) / attempts;
    await client.hSet(key, "avg_duration_ms", newAvg.toString());

    console.log(
      `[Strategy] Recorded ${strategy} ${success ? "success" : "failure"} for ${urlPattern} (${durationMs}ms)`
    );
  },
  {
    summarize: () => ({
      "webscout.strategy_outcome": "recorded",
    }),
  }
);

/**
 * Get ordered strategies for a URL pattern based on historical success rates.
 * Falls back to default order if no history exists.
 */
export const getOrderedStrategies = createTracedOp(
  "getOrderedStrategies",
  async function getOrderedStrategies(urlPattern: string): Promise<string[]> {
    const client = await getRedisClient();
    const stats: StrategyStats[] = [];

    for (const strategy of ALL_STRATEGIES) {
      const key = `${STRATEGY_PREFIX}${urlPattern}:${strategy}`;
      try {
        const data = await client.hGetAll(key);
        if (data && data.attempts) {
          const attempts = parseInt(data.attempts, 10);
          const successes = parseInt(data.successes || "0", 10);
          stats.push({
            strategy,
            attempts,
            successes,
            avgDurationMs: parseFloat(data.avg_duration_ms || "0"),
            successRate: attempts > 0 ? successes / attempts : 0,
          });
        }
      } catch {
        // No data for this strategy — skip
      }
    }

    if (stats.length === 0) {
      return ALL_STRATEGIES; // Default order
    }

    // Sort by success rate (desc), break ties by avg duration (asc)
    stats.sort((a, b) => {
      if (Math.abs(a.successRate - b.successRate) > 0.01) {
        return b.successRate - a.successRate;
      }
      return a.avgDurationMs - b.avgDurationMs;
    });

    // Include strategies without history at the end
    const ordered = stats.map(s => s.strategy);
    const remaining = ALL_STRATEGIES.filter(s => !ordered.includes(s));
    return [...ordered, ...remaining];
  },
  {
    callDisplayName: (urlPattern: string) => `strategies:${urlPattern.substring(0, 30)}`,
  }
);

/**
 * Get all strategy stats for display in the dashboard.
 */
export async function getAllStrategyStats(): Promise<Record<string, StrategyStats[]>> {
  const client = await getRedisClient();
  const result: Record<string, StrategyStats[]> = {};

  try {
    // Scan for all strategy stat keys
    let cursor: string = "0";
    const keys: string[] = [];
    do {
      const reply = await client.scan(cursor, { MATCH: `${STRATEGY_PREFIX}*`, COUNT: 100 });
      cursor = reply.cursor as string;
      keys.push(...(reply.keys as string[]));
    } while (cursor !== "0");

    for (const key of keys) {
      const parts = key.replace(STRATEGY_PREFIX, "").split(":");
      const urlPattern = parts.slice(0, -1).join(":");
      const strategy = parts[parts.length - 1];

      if (!result[urlPattern]) result[urlPattern] = [];
      const data = await client.hGetAll(key);
      const attempts = parseInt(data.attempts || "0", 10);
      const successes = parseInt(data.successes || "0", 10);
      result[urlPattern].push({
        strategy,
        attempts,
        successes,
        avgDurationMs: parseFloat(data.avg_duration_ms || "0"),
        successRate: attempts > 0 ? successes / attempts : 0,
      });
    }
  } catch {
    // Redis scan failed
  }

  return result;
}
