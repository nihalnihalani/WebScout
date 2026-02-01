import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis/client";
import { getPatternCount } from "@/lib/redis/patterns";
import type { TaskResult } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

interface TimelinePoint {
  taskNumber: number;
  timestamp: number;
  success: boolean;
  usedCache: boolean;
  recoveryAttempted: boolean;
  durationMs: number;
  cumulativeCacheHits: number;
  cumulativeSuccess: number;
  cumulativePatterns: number;
  cacheHitRate: number;
  successRate: number;
}

export async function GET() {
  try {
    const client = await getRedisClient();

    // Get all task IDs from the timeline sorted set (oldest first)
    const taskIds = await client.zRange("tasks:timeline", 0, -1);

    // Fetch and parse each task
    const tasks: TaskResult[] = [];
    for (const id of taskIds) {
      const data = await client.hGet(`task:${id}`, "data");
      if (data) {
        try {
          tasks.push(JSON.parse(data) as TaskResult);
        } catch {
          console.error(`[Metrics] Failed to parse task ${id}`);
        }
      }
    }

    // Sort by created_at ascending
    tasks.sort((a, b) => a.created_at - b.created_at);

    // Build the time-series with cumulative metrics
    let cumulativeCacheHits = 0;
    let cumulativeSuccess = 0;
    let totalDuration = 0;
    const patternIds = new Set<string>();

    const timeline: TimelinePoint[] = tasks.map((task, index) => {
      const taskNumber = index + 1;
      const success = task.status === "success";
      const usedCache = task.used_cached_pattern;
      const recoveryAttempted = task.recovery_attempted;
      const durationMs =
        task.completed_at && task.created_at
          ? task.completed_at - task.created_at
          : 0;

      if (usedCache) cumulativeCacheHits++;
      if (success) cumulativeSuccess++;
      if (task.pattern_id) patternIds.add(task.pattern_id);
      totalDuration += durationMs;

      const cacheHitRate =
        taskNumber > 0
          ? Math.round((cumulativeCacheHits / taskNumber) * 10000) / 100
          : 0;

      const successRate =
        taskNumber > 0
          ? Math.round((cumulativeSuccess / taskNumber) * 10000) / 100
          : 0;

      return {
        taskNumber,
        timestamp: task.created_at,
        success,
        usedCache,
        recoveryAttempted,
        durationMs,
        cumulativeCacheHits,
        cumulativeSuccess,
        cumulativePatterns: patternIds.size,
        cacheHitRate,
        successRate,
      };
    });

    // Get current pattern count from the search index
    const patternsLearned = await getPatternCount();

    const totalTasks = tasks.length;
    const avgDuration =
      totalTasks > 0 ? Math.round(totalDuration / totalTasks) : 0;
    const currentCacheHitRate =
      totalTasks > 0
        ? Math.round((cumulativeCacheHits / totalTasks) * 10000) / 100
        : 0;
    const currentSuccessRate =
      totalTasks > 0
        ? Math.round((cumulativeSuccess / totalTasks) * 10000) / 100
        : 0;

    const summary = {
      totalTasks,
      patternsLearned,
      avgDuration,
      currentCacheHitRate,
      currentSuccessRate,
      generation: patternsLearned,
    };

    return NextResponse.json({ timeline, summary });
  } catch (error) {
    console.error("[Metrics] Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
