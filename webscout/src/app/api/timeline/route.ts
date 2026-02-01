import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis/client";
import type { TaskResult } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await getRedisClient();

    // Fetch last 20 task IDs from the sorted set, newest first
    const taskIds = await client.zRange("tasks:timeline", "+inf", "-inf", {
      BY: "SCORE",
      REV: true,
      LIMIT: { offset: 0, count: 20 },
    });

    const tasks: TaskResult[] = [];

    for (const id of taskIds) {
      const data = await client.hGet(`task:${id}`, "data");
      if (data) {
        try {
          const parsed = JSON.parse(data) as TaskResult;
          tasks.push(parsed);
        } catch {
          console.error(`[Timeline] Failed to parse task ${id}`);
        }
      }
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[Timeline] Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
