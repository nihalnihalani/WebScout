import type { SearchReply } from "@redis/search";
import { getRedisClient } from "./client";
import type { PagePattern } from "../utils/types";

export async function listPatterns(
  limit: number = 50,
  offset: number = 0
): Promise<{ patterns: PagePattern[]; total: number }> {
  const client = await getRedisClient();
  try {
    const results = await client.ft.search("idx:page_patterns", "*", {
      SORTBY: { BY: "success_count", DIRECTION: "DESC" },
      LIMIT: { from: offset, size: limit },
      RETURN: [
        "url_pattern", "target", "working_selector",
        "approach", "success_count", "failure_count",
        "created_at", "last_succeeded_at", "last_failed_at",
      ],
    }) as unknown as SearchReply;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patterns: PagePattern[] = results.documents.map((doc: any) => ({
      id: doc.id,
      url_pattern: doc.value.url_pattern as string,
      target: doc.value.target as string,
      working_selector: doc.value.working_selector as string,
      approach: doc.value.approach as "extract" | "act" | "agent",
      success_count: parseInt(doc.value.success_count as string, 10) || 0,
      failure_count: parseInt(doc.value.failure_count as string, 10) || 0,
      created_at: parseInt(doc.value.created_at as string, 10) || 0,
      last_succeeded_at: doc.value.last_succeeded_at ? parseInt(doc.value.last_succeeded_at as string, 10) : undefined,
      last_failed_at: doc.value.last_failed_at ? parseInt(doc.value.last_failed_at as string, 10) : undefined,
    }));
    return { patterns, total: results.total };
  } catch (error) {
    console.error("[Redis] listPatterns failed:", error);
    return { patterns: [], total: 0 };
  }
}

export async function getPattern(patternId: string): Promise<PagePattern | null> {
  const client = await getRedisClient();
  const data = await client.hGetAll(patternId);
  if (!data || !data.url_pattern) return null;
  return {
    id: patternId,
    url_pattern: data.url_pattern,
    target: data.target,
    working_selector: data.working_selector,
    approach: data.approach as "extract" | "act" | "agent",
    success_count: parseInt(data.success_count, 10) || 0,
    failure_count: parseInt(data.failure_count, 10) || 0,
    created_at: parseInt(data.created_at, 10) || 0,
    last_succeeded_at: data.last_succeeded_at ? parseInt(data.last_succeeded_at, 10) : undefined,
    last_failed_at: data.last_failed_at ? parseInt(data.last_failed_at, 10) : undefined,
  };
}

export async function deletePattern(patternId: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(patternId);
}

export async function getPatternCount(): Promise<number> {
  const client = await getRedisClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = await client.ft.info("idx:page_patterns") as any;
    return info.num_docs ?? info.numDocs ?? 0;
  } catch {
    return 0;
  }
}
