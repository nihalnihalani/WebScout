"use client";

import { ImprovementReport } from "@/components/improvement-report";
import { LearningCurve } from "@/components/learning-curve";

export default function EvaluationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Self-Improvement Evaluation</h2>
        <p className="text-zinc-500 mt-1">
          Quantitative proof that WebScout gets better over time
        </p>
      </div>

      <ImprovementReport />
      <LearningCurve />
    </div>
  );
}
