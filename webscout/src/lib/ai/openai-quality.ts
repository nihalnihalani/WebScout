import OpenAI from "openai";
import { createTracedOp } from "../tracing/weave";

// ---------------------------------------------------------------------------
// OpenAI client singleton (separate from embeddings client)
// ---------------------------------------------------------------------------

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QualityAssessment {
  quality_score: number;
  summary: string;
  confidence: string;
}

// ---------------------------------------------------------------------------
// Traced operation — the ONLY direct OpenAI chat completion in the project
// ---------------------------------------------------------------------------

/**
 * Assess the quality of an extraction result using GPT-4o-mini.
 *
 * This is a direct OpenAI chat completion call (NOT through Stagehand) that
 * scores how well the extracted data matches what was requested, demonstrating
 * deeper OpenAI integration beyond embeddings.
 */
export const assessExtractionQuality = createTracedOp(
  "assessExtractionQuality",
  async function assessExtractionQuality(
    target: string,
    result: unknown,
    url: string
  ): Promise<QualityAssessment> {
    const resultStr =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a data-quality evaluator for a web-scraping system.",
            "Given a target description, the URL that was scraped, and the extracted result,",
            "assess how well the result satisfies the target request.",
            "",
            "Respond with ONLY a JSON object containing:",
            '  "quality_score": integer 0-100 (100 = perfect match),',
            '  "summary": a one-sentence explanation of the assessment,',
            '  "confidence": one of "high", "medium", "low".',
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `URL: ${url}`,
            `Target: ${target}`,
            `Extracted result:\n${resultStr.substring(0, 4000)}`,
          ].join("\n"),
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "{}";

    try {
      const parsed = JSON.parse(text) as QualityAssessment;
      return {
        quality_score: Math.max(0, Math.min(100, Number(parsed.quality_score) || 0)),
        summary: parsed.summary || "Unable to assess quality.",
        confidence: parsed.confidence || "low",
      };
    } catch {
      return {
        quality_score: 0,
        summary: "Failed to parse quality assessment response.",
        confidence: "low",
      };
    }
  },
  {
    callDisplayName: (target: string) =>
      `quality:${target.substring(0, 40)}`,
    summarize: (result: QualityAssessment) => ({
      "webscout.quality_score": result.quality_score,
      "webscout.quality_confidence": result.confidence,
    }),
  }
);
