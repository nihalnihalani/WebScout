import useSWR from "swr";
import type { PagePattern } from "@/lib/utils/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function usePatterns() {
  return useSWR<{
    patterns: PagePattern[];
    total: number;
  }>("/api/patterns", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}
