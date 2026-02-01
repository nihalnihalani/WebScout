import useSWR from "swr";
import type { TaskResult } from "@/lib/utils/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function useTasks() {
  return useSWR<{
    tasks: TaskResult[];
    total: number;
    stats: {
      total: number;
      successful: number;
      failed: number;
      cached: number;
      recovered: number;
      patterns_learned: number;
      cache_hit_rate: string;
      recovery_rate: string;
    };
  }>("/api/tasks", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });
}

export function useTask(id: string) {
  return useSWR<TaskResult>(
    id ? `/api/tasks/${id}` : null,
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: true,
    }
  );
}
