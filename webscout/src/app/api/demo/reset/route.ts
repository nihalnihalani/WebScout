import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/reset
 * Clears all task data from Redis. Use before re-seeding.
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

    return NextResponse.json({
      message: "All task data cleared",
      tasks_removed: taskIds.length,
    });
  } catch (error) {
    console.error("[Demo] Reset failed:", error);
    return NextResponse.json(
      { error: "Failed to reset data", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
