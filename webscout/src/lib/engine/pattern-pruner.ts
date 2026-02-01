import { createTracedOp } from "../tracing/weave";
import { listPatterns, deletePattern } from "../redis/patterns";
import { computePatternFitness } from "./pattern-fitness";

/**
 * Remove dead patterns: fitness < 0.05 AND failure_count >= 3.
 * This prevents the vector cache from being polluted with unreliable patterns.
 */
export const pruneDeadPatterns = createTracedOp(
  "pruneDeadPatterns",
  async function pruneDeadPatterns(): Promise<{
    pruned: number;
    remaining: number;
    prunedIds: string[];
  }> {
    const { patterns } = await listPatterns(1000, 0);
    const prunedIds: string[] = [];

    for (const pattern of patterns) {
      const fitness = computePatternFitness(pattern);
      if (fitness < 0.05 && pattern.failure_count >= 3) {
        await deletePattern(pattern.id);
        prunedIds.push(pattern.id);
        console.log(
          `[Pruner] Removed dead pattern ${pattern.id} (fitness=${fitness.toFixed(3)}, failures=${pattern.failure_count})`
        );
      }
    }

    return {
      pruned: prunedIds.length,
      remaining: patterns.length - prunedIds.length,
      prunedIds,
    };
  },
  {
    summarize: (result) => ({
      "webscout.patterns_pruned": result.pruned,
      "webscout.patterns_remaining": result.remaining,
    }),
  }
);
