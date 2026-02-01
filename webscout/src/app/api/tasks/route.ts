import { NextRequest, NextResponse } from "next/server";
import { learningScrape } from "@/lib/engine/scraper";
import { storeTask, listTasks, getTaskStats } from "@/lib/redis/tasks";
import { getPatternCount } from "@/lib/redis/patterns";
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

    const result = await learningScrape({ url, target });

    await storeTask(result);

    console.log(
      `[API] Task ${result.id} completed: ${result.status}` +
      (result.used_cached_pattern ? " (cached)" : "") +
      (result.recovery_attempted ? " (recovered)" : "")
    );

    return NextResponse.json(result);
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
