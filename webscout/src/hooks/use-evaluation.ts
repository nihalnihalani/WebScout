import useSWR from "swr";

interface CohortMetrics {
  label: string;
  taskCount: number;
  successRate: number;
  avgDurationMs: number;
  cacheHitRate: number;
  recoveryRate: number;
  patternsUsed: number;
  avgQualityScore?: number;
}

interface ImprovementMetric {
  metric: string;
  firstCohort: number;
  lastCohort: number;
  improvement: number;
  improvementPct: string;
  direction: "better" | "worse" | "same";
  unit: string;
}

interface EvaluationData {
  improvement_score: number;
  improvement_grade: string;
  speed_factor: string;
  patterns_learned: number;
  cohorts: {
    first: CohortMetrics;
    middle: CohortMetrics;
    last: CohortMetrics;
  };
  improvements: ImprovementMetric[];
  summary: {
    headline: string;
    success_rate_change: string;
    speed_change: string;
    cache_change: string;
  };
}

interface EvaluationResponse {
  status: "evaluated" | "insufficient_data";
  tasks_analyzed: number;
  evaluation: EvaluationData | null;
  message?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export function useEvaluation() {
  return useSWR<EvaluationResponse>("/api/evaluation", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });
}

export type { EvaluationData, ImprovementMetric, CohortMetrics };
