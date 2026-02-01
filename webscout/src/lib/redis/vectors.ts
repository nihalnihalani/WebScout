import { SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from "redis";
import type { SearchReply } from "@redis/search";
import { getRedisClient } from "./client";
import { generateEmbedding } from "../embeddings/openai";
import { createTracedOp } from "../tracing/weave";
import type { PatternData, PagePattern } from "../utils/types";

const INDEX_NAME = "idx:page_patterns";
const PREFIX = "pattern:";
const VECTOR_DIM = 1536;

export const ensureVectorIndex = createTracedOp(
  "ensureVectorIndex",
  async function ensureVectorIndex(): Promise<void> {
    const client = await getRedisClient();
    try {
      await client.ft.info(INDEX_NAME);
    } catch {
      console.log("[Redis] Creating vector index:", INDEX_NAME);
      await client.ft.create(
        INDEX_NAME,
        {
          url_pattern: { type: SCHEMA_FIELD_TYPE.TEXT, SORTABLE: true },
          target: { type: SCHEMA_FIELD_TYPE.TEXT },
          working_selector: { type: SCHEMA_FIELD_TYPE.TEXT },
          approach: { type: SCHEMA_FIELD_TYPE.TAG },
          created_at: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
          success_count: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
          failure_count: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
          last_succeeded_at: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
          last_failed_at: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
          embedding: {
            type: SCHEMA_FIELD_TYPE.VECTOR,
            ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
            TYPE: "FLOAT32",
            DIM: VECTOR_DIM,
            DISTANCE_METRIC: "COSINE",
          },
        },
        { ON: "HASH", PREFIX: PREFIX }
      );
      console.log("[Redis] Vector index created successfully");
    }
  }
);

export const searchSimilarPatterns = createTracedOp(
  "searchSimilarPatterns",
  async function searchSimilarPatterns(
    queryText: string,
    topK: number = 3
  ): Promise<PagePattern[]> {
    const client = await getRedisClient();
    const embedding = await generateEmbedding(queryText);
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
    try {
      const results = await client.ft.search(
        INDEX_NAME,
        `*=>[KNN ${topK} @embedding $BLOB AS vector_score]`,
        {
          PARAMS: { BLOB: embeddingBuffer },
          SORTBY: { BY: "vector_score", DIRECTION: "ASC" },
          DIALECT: 2,
          RETURN: [
            "url_pattern", "target", "working_selector",
            "approach", "vector_score", "success_count", "failure_count",
            "created_at", "last_succeeded_at", "last_failed_at",
          ],
        }
      ) as unknown as SearchReply;
      if (!results.documents || results.documents.length === 0) {
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return results.documents.map((doc: any) => ({
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
        score: 1 - parseFloat(doc.value.vector_score as string) / 2,
      }));
    } catch (error) {
      console.error("[Redis] Vector search failed:", error);
      return [];
    }
  },
  {
    callDisplayName: (queryText: string) =>
      `vector_search:${queryText.substring(0, 40)}...`,
  }
);

export const storePattern = createTracedOp(
  "storePattern",
  async function storePattern(data: PatternData): Promise<string> {
    const client = await getRedisClient();
    const embeddingText = `${data.url_pattern} ${data.target}`;
    const embedding = await generateEmbedding(embeddingText);
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

    // Check for an existing pattern with the same url_pattern + target to
    // avoid duplicates.  If found, update the existing pattern instead.
    try {
      const existing = await client.ft.search(
        INDEX_NAME,
        `*=>[KNN 1 @embedding $BLOB AS vector_score]`,
        {
          PARAMS: { BLOB: embeddingBuffer },
          SORTBY: { BY: "vector_score", DIRECTION: "ASC" },
          DIALECT: 2,
          RETURN: ["url_pattern", "target", "vector_score"],
        }
      ) as unknown as SearchReply;

      if (existing.documents && existing.documents.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = existing.documents[0] as any;
        const distance = parseFloat(doc.value.vector_score as string);
        const similarity = 1 - distance / 2;
        const sameUrl = doc.value.url_pattern === data.url_pattern;
        const sameTarget = doc.value.target === data.target;

        if (similarity > 0.95 && sameUrl && sameTarget) {
          // Update existing pattern instead of creating a duplicate
          const existingId = doc.id as string;
          await Promise.all([
            client.hIncrBy(existingId, "success_count", 1),
            client.hSet(existingId, {
              last_succeeded_at: Date.now().toString(),
              working_selector: data.working_selector,
            }),
          ]);
          console.log(`[Redis] Updated existing pattern: ${existingId} (similarity=${(similarity * 100).toFixed(1)}%)`);
          return existingId;
        }
      }
    } catch {
      // If dedup search fails, fall through to create a new pattern
    }

    const id = `${PREFIX}${crypto.randomUUID()}`;
    await client.hSet(id, {
      url_pattern: data.url_pattern,
      target: data.target,
      working_selector: data.working_selector,
      approach: data.approach,
      created_at: Date.now().toString(),
      success_count: "1",
      failure_count: "0",
      last_succeeded_at: Date.now().toString(),
      embedding: embeddingBuffer,
    });
    console.log(`[Redis] Stored new pattern: ${id}`);
    return id;
  },
  {
    summarize: () => ({
      "webscout.pattern_stored": 1,
    }),
  }
);

export const incrementPatternSuccess = createTracedOp(
  "incrementPatternSuccess",
  async function incrementPatternSuccess(patternId: string): Promise<void> {
    const client = await getRedisClient();
    await client.hIncrBy(patternId, "success_count", 1);
  }
);

export const incrementPatternFailure = createTracedOp(
  "incrementPatternFailure",
  async function incrementPatternFailure(patternId: string): Promise<void> {
    const client = await getRedisClient();
    await Promise.all([
      client.hIncrBy(patternId, "failure_count", 1),
      client.hSet(patternId, "last_failed_at", Date.now().toString()),
    ]);
    console.log(`[Redis] Pattern failure recorded: ${patternId}`);
  },
  {
    summarize: () => ({ "webscout.pattern_failure_recorded": 1 }),
  }
);

export const updatePatternLastSuccess = createTracedOp(
  "updatePatternLastSuccess",
  async function updatePatternLastSuccess(patternId: string): Promise<void> {
    const client = await getRedisClient();
    await Promise.all([
      client.hIncrBy(patternId, "success_count", 1),
      client.hSet(patternId, "last_succeeded_at", Date.now().toString()),
    ]);
  },
  {
    summarize: () => ({ "webscout.pattern_success_updated": 1 }),
  }
);
