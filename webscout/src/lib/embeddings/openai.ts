import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim().substring(0, 8000),
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.trim().substring(0, 8000)),
  });
  return response.data.map((d) => d.embedding);
}

export async function generateEmbeddingSafe(text: string): Promise<number[] | null> {
  try {
    return await generateEmbedding(text);
  } catch (error) {
    console.warn("[Embeddings] Failed to generate embedding:", (error as Error).message);
    return null;
  }
}
