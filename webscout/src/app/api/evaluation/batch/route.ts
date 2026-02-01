import { NextRequest, NextResponse } from "next/server";
import { initWeave } from "@/lib/tracing/weave";
import { runBatchEvaluation } from "@/lib/evaluation/batch-eval";
import { runWeaveEvaluation } from "@/lib/evaluation/batch-eval";

export const dynamic = "force-dynamic";

/**
 * POST /api/evaluation/batch
 *
 * Triggers a full batch evaluation across all completed tasks.
 * Supports two modes via ?mode= query parameter:
 *   - "legacy" (default): cohort comparison (early vs recent)
 *   - "weave": formal Weave Evaluation with typed scorers
 * The run is traced in Weave so judges can inspect it.
 */
export async function POST(request: NextRequest) {
  try {
    await initWeave();

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "legacy";

    if (mode === "weave") {
      const result = await runWeaveEvaluation();
      return NextResponse.json(result);
    }

    // Default: legacy cohort comparison
    const result = await runBatchEvaluation();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[BatchEval] Failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Batch evaluation failed",
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
