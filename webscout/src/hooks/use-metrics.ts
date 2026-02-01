import useSWR from "swr";

interface MetricsTimeline {
  taskNumber: number;
  timestamp: number;
  success: boolean;
  usedCache: boolean;
  recoveryAttempted: boolean;
  durationMs: number;
  cumulativeCacheHits: number;
  cumulativeSuccess: number;
  cumulativePatterns: number;
  cacheHitRate: number;
  successRate: number;
}

interface MetricsSummary {
  totalTasks: number;
  patternsLearned: number;
  avgDuration: number;
  currentCacheHitRate: number;
  currentSuccessRate: number;
  generation: number;
}

interface MetricsResponse {
  timeline: MetricsTimeline[];
  summary: MetricsSummary;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export function useMetrics() {
  return useSWR<MetricsResponse>("/api/metrics", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}
