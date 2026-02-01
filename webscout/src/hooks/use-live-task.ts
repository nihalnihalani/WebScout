import useSWR from "swr";
import type { TaskResult } from "@/lib/utils/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function useLiveTask(taskId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TaskResult>(
    taskId ? `/api/tasks/${taskId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) => {
        // Poll every 1s while running, stop when complete
        if (!latestData) return 1000;
        if (latestData.status === "running" || latestData.status === "pending") {
          return 1000;
        }
        return 0;
      },
      revalidateOnFocus: true,
      dedupingInterval: 500,
    }
  );

  const isRunning =
    data?.status === "running" || data?.status === "pending";

  return {
    task: data ?? null,
    isRunning,
    isLoading,
    error: error ? (error as Error).message : null,
    mutate,
  };
}
