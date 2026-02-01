import OpenAI from "openai";
import { createTracedOp } from "../tracing/weave";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai!;
}

// Async initializer: wraps OpenAI with Weave tracing if available
let weaveWrapped = false;
export async function initOpenAITracing(): Promise<void> {
  if (weaveWrapped) return;
  try {
    const weaveModule = await import("weave");
    if (weaveModule.wrapOpenAI) {
      const client = getOpenAI();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      openai = weaveModule.wrapOpenAI(client as any) as unknown as OpenAI;
      weaveWrapped = true;
      console.log("[OpenAI] Wrapped with Weave tracing");
    }
  } catch {
    // wrapOpenAI not available
  }
}

export const generateEmbedding = createTracedOp(
  "generateEmbedding",
  async function generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: text.trim().substring(0, 8000),
    });
    return response.data[0].embedding;
  },
  {
    callDisplayName: (text: string) =>
      `embed:${text.substring(0, 40)}...`,
  }
);

export const generateEmbeddings = createTracedOp(
  "generateEmbeddings",
  async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: texts.map((t) => t.trim().substring(0, 8000)),
    });
    return response.data.map((d) => d.embedding);
  }
);

export async function generateEmbeddingSafe(text: string): Promise<number[] | null> {
  try {
    return await generateEmbedding(text);
  } catch (error) {
    console.warn("[Embeddings] Failed to generate embedding:", (error as Error).message);
    return null;
  }
}
