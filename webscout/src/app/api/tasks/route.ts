import { NextRequest, NextResponse } from "next/server";
import { learningScrape } from "@/lib/engine/scraper";
import { storeTask, listTasks, getTaskStats } from "@/lib/redis/tasks";
import { getPatternCount } from "@/lib/redis/patterns";
import { addScoreToCall } from "@/lib/tracing/weave";
import type { TaskRequest } from "@/lib/utils/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, target } = body as TaskRequest;

    if (!url || !target) {
      return NextResponse.json(
        { error: "Both 'url' and 'target' fields are required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format. Must be a valid absolute URL (e.g., https://example.com)" },
        { status: 400 }
      );
    }

    if (target.trim().length === 0) {
      return NextResponse.json(
        { error: "'target' must describe what to extract (e.g., 'product price and title')" },
        { status: 400 }
      );
    }

    console.log(`[API] New task: extract "${target}" from ${url}`);

    // Create a placeholder task immediately so the UI can track it
    const taskId = crypto.randomUUID();
    const pendingTask = {
      id: taskId,
      url,
      target,
      status: "running" as const,
      result: null,
      used_cached_pattern: false,
      recovery_attempted: false,
      pattern_id: undefined,
      screenshots: [],
      steps: [
        { action: "queued", status: "info" as const, detail: "Task queued — starting browser automation...", timestamp: Date.now() },
      ],
      created_at: Date.now(),
      completed_at: undefined,
    };

    await storeTask(pendingTask as import("@/lib/utils/types").TaskResult);

    // Execute the scrape in the background (non-blocking)
    // Use .invoke() to capture Weave call ID for the closed feedback loop
    const executeTask = async () => {
      if (typeof learningScrape.invoke === "function") {
        const [result, call] = await learningScrape.invoke({ url, target, id: taskId });
        result.trace_id = call?.traceId;
        result.weave_call_id = call?.id;
        return result;
      }
      return learningScrape({ url, target, id: taskId });
    };

    executeTask().then(async (result) => {
      await storeTask(result);
      console.log(
        `[API] Task ${result.id} completed: ${result.status}` +
        (result.used_cached_pattern ? " (cached)" : "") +
        (result.recovery_attempted ? " (recovered)" : "") +
        (result.trace_id ? ` (trace: ${result.trace_id.substring(0, 12)}...)` : "")
      );

      // Attach retrospective scores to the Weave call (Phase 5 feedback loop)
      if (result.weave_call_id) {
        Promise.all([
          addScoreToCall(result.weave_call_id, "success", result.status === "success"),
          addScoreToCall(
            result.weave_call_id,
            "quality",
            result.quality_score ?? 0,
            result.quality_summary
          ),
          addScoreToCall(
            result.weave_call_id,
            "used_cache",
            result.used_cached_pattern
          ),
          addScoreToCall(
            result.weave_call_id,
            "recovery_needed",
            result.recovery_attempted
          ),
        ]).catch(console.warn);
      }
    }).catch((error) => {
      console.error(`[API] Task ${taskId} failed:`, error);
      storeTask({
        ...pendingTask,
        status: "failed",
        steps: [...pendingTask.steps, { action: "error", status: "failure" as const, detail: (error as Error).message, timestamp: Date.now() }],
        completed_at: Date.now(),
      } as import("@/lib/utils/types").TaskResult).catch(console.error);
    });

    return NextResponse.json(pendingTask);
  } catch (error) {
    console.error("[API] Task execution error:", error);
    return NextResponse.json(
      {
        error: "Task execution failed",
        detail: (error as Error).message,
        hint: "Check server logs for more details. Common causes: Browserbase API key invalid, Redis not running, or page navigation timeout.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    const [{ tasks, total }, stats, patternCount] = await Promise.all([
      listTasks(limit, offset),
      getTaskStats(),
      getPatternCount(),
    ]);

    const cacheHitRate =
      stats.total > 0
        ? ((stats.cached / stats.total) * 100).toFixed(1) + "%"
        : "0%";

    const recoveryRate =
      stats.recovered + stats.failed > 0
        ? (
            (stats.recovered / (stats.recovered + stats.failed)) *
            100
          ).toFixed(1) + "%"
        : "N/A";

    return NextResponse.json({
      tasks,
      total,
      stats: {
        ...stats,
        patterns_learned: patternCount,
        cache_hit_rate: cacheHitRate,
        recovery_rate: recoveryRate,
      },
    });
  } catch (error) {
    console.error("[API] List tasks error:", error);
    return NextResponse.json(
      { error: "Failed to list tasks", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
