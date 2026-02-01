"use client";

import { useState, useCallback } from "react";
import { ImprovementReport } from "@/components/improvement-report";
import { LearningCurve } from "@/components/learning-curve";
import { useEvaluation } from "@/hooks/use-evaluation";
import { useMetrics } from "@/hooks/use-metrics";
import { BarChart3, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";

type ToastState = null | { type: "success"; message: string } | { type: "error"; message: string };

export default function EvaluationPage() {
  const { data: evalData, isLoading: evalLoading, mutate: refreshEval } = useEvaluation();
  const { data: metricsData, isLoading: metricsLoading } = useMetrics();

  const [batchRunning, setBatchRunning] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const runBatchEval = useCallback(async () => {
    setBatchRunning(true);
    setToast(null);
    try {
      const res = await fetch("/api/evaluation/batch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", message: data.detail || data.message || "Batch evaluation failed" });
      } else if (data.status === "insufficient_data") {
        setToast({ type: "error", message: data.message || "Not enough completed tasks" });
      } else {
        const score = data.summary?.overall_improvement_score ?? 0;
        setToast({
          type: "success",
          message: `Batch evaluation complete -- overall improvement score: ${score}`,
        });
        // Refresh the evaluation data so the page updates
        if (refreshEval) refreshEval();
      }
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message || "Network error" });
    } finally {
      setBatchRunning(false);
      // Auto-dismiss toast after 6 seconds
      setTimeout(() => setToast(null), 6000);
    }
  }, [refreshEval]);

  const isLoading = evalLoading || metricsLoading;
  const hasInsufficientData =
    !isLoading &&
    evalData?.status === "insufficient_data" &&
    (!metricsData?.timeline || metricsData.timeline.length === 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Self-Improvement Evaluation</h2>
          <p className="text-zinc-500 mt-1">
            Quantitative proof that WebScout gets better over time
          </p>
        </div>
        <button
          onClick={runBatchEval}
          disabled={batchRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {batchRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Evaluation
            </>
          )}
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-green-800 bg-green-950 text-green-300"
              : "border-red-800 bg-red-950 text-red-300"
          }`}
        >
          <span className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {toast.message}
          </span>
          <button
            onClick={dismissToast}
            className="ml-4 text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {hasInsufficientData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <BarChart3 className="h-8 w-8 text-zinc-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Not enough data for evaluation
          </h3>
          <p className="max-w-sm text-sm text-zinc-500">
            Run at least 5 tasks to generate improvement metrics.
          </p>
        </div>
      ) : (
        <>
          <ImprovementReport />
          <LearningCurve />
        </>
      )}
    </div>
  );
}
