import { NextRequest, NextResponse } from "next/server";
import { listPatterns } from "@/lib/redis/patterns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0
    );

    const { patterns, total } = await listPatterns(limit, offset);

    return NextResponse.json({ patterns, total });
  } catch (error) {
    console.error("[API] List patterns error:", error);
    return NextResponse.json(
      { error: "Failed to list patterns", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
