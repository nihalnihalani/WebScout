import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { storePattern } from "@/lib/redis/vectors";
import { extractUrlPattern } from "@/lib/utils/url";
import { createTracedOp } from "@/lib/tracing/weave";
import type { PatternData } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

const teachRequestSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  target: z.string().min(1, "Target description is required"),
  selector: z.string().min(1, "Selector or instruction is required"),
  approach: z.enum(["extract", "act", "agent"]),
  notes: z.string().optional(),
});

const teachPattern = createTracedOp(
  "teachPattern",
  async function teachPattern(data: PatternData & { notes?: string }): Promise<string> {
    const patternId = await storePattern({
      url_pattern: data.url_pattern,
      target: data.target,
      working_selector: data.working_selector,
      approach: data.approach,
    });

    console.log(
      `[Teach] Pattern taught: ${patternId} | ` +
        `url_pattern=${data.url_pattern} | target=${data.target} | ` +
        `approach=${data.approach}` +
        (data.notes ? ` | notes=${data.notes}` : "")
    );

    return patternId;
  },
  {
    summarize: () => ({
      "webscout.pattern_taught": 1,
      "webscout.source": "teaching_mode",
    }),
    callDisplayName: (_data: PatternData & { notes?: string }) =>
      `teach:${_data.url_pattern}`,
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = teachRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { url, target, selector, approach, notes } = parsed.data;

    const urlPattern = extractUrlPattern(url);

    const patternId = await teachPattern({
      url_pattern: urlPattern,
      target,
      working_selector: selector,
      approach,
      notes,
    });

    return NextResponse.json({
      success: true,
      pattern_id: patternId,
      url_pattern: urlPattern,
      message: `Pattern taught successfully for ${urlPattern}`,
    });
  } catch (error) {
    console.error("[API] Teach pattern error:", error);
    return NextResponse.json(
      {
        error: "Failed to teach pattern",
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
