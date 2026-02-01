import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/redis/tasks";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length < 8) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 }
      );
    }

    const task = await getTask(id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found", id },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("[API] Get task error:", error);
    return NextResponse.json(
      { error: "Failed to get task", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
