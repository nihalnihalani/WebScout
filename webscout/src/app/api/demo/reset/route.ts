import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis/client";


export const dynamic = "force-dynamic";

/**
 * POST /api/demo/reset
 * Clears all task data AND learned patterns from Redis.
 * Use before re-seeding or starting a fresh demo.
 */
export async function POST() {
  try {
    const client = await getRedisClient();

    // Get all task IDs
    const taskIds = await client.zRange("tasks:timeline", 0, -1);

    // Delete each task hash
    for (const id of taskIds) {
      await client.del(`task:${id}`);
    }

    // Delete the timeline
    await client.del("tasks:timeline");

    // Clear all learned patterns using FT.SEARCH to find them reliably
    let patternsCleaned = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await client.ft.search("idx:page_patterns", "*", {
        LIMIT: { from: 0, size: 1000 },
      }) as any;
      for (const doc of results.documents) {
        await client.del(doc.id);
        patternsCleaned++;
      }
    } catch (e) {
      console.warn("[Demo] Pattern cleanup via index failed, trying scan:", e);
      // Fallback: use scanIterator
      try {
        for await (const key of client.scanIterator({ MATCH: "pattern:*", COUNT: 100 })) {
          await client.del(key);
          patternsCleaned++;
        }
      } catch (e2) {
        console.warn("[Demo] Pattern scan fallback failed:", e2);
      }
    }

    // Drop and recreate the vector index so it's clean
    try {
      await client.ft.dropIndex("idx:page_patterns");
      console.log("[Demo] Dropped vector index");
    } catch {
      // Index might not exist
    }

    // Clear strategy stats
    let strategiesCleaned = 0;
    try {
      for await (const key of client.scanIterator({ MATCH: "strategy_stats:*", COUNT: 100 })) {
        await client.del(key);
        strategiesCleaned++;
      }
    } catch (e) {
      console.warn("[Demo] Strategy stats cleanup failed:", e);
    }

    // Clear dynamic confidence threshold
    await client.del("webscout:confidence_threshold").catch(() => {});

    return NextResponse.json({
      message: "All data cleared (tasks, patterns, strategies, threshold)",
      tasks_removed: taskIds.length,
      patterns_removed: patternsCleaned,
      strategies_removed: strategiesCleaned,
    });
  } catch (error) {
    console.error("[Demo] Reset failed:", error);
    return NextResponse.json(
      { error: "Failed to reset data", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
