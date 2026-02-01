import useSWR from "swr";
import type { TaskResult } from "@/lib/utils/types";

interface TimelineData {
  tasks: TaskResult[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function useTimeline() {
  return useSWR<TimelineData>("/api/timeline", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });
}
