import { GoogleGenerativeAI } from "@google/generative-ai";
import { createTracedOp } from "../tracing/weave";

// ---------------------------------------------------------------------------
// Gemini client singleton
// ---------------------------------------------------------------------------

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY is not set. " +
          "Get one at https://aistudio.google.com/apikey"
      );
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns true when the Gemini API key is configured. */
export function isGeminiAvailable(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeminiRecoveryStrategy {
  suggestedSelector: string;
  action: string;
  reasoning: string;
}

export interface GeminiPageAnalysis {
  extractionStrategy: string;
  suggestedSelectors: string[];
  pageStructureSummary: string;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Traced operations
// ---------------------------------------------------------------------------

/**
 * Ask Gemini to analyse a failed extraction and propose a CSS selector /
 * extraction approach that is likely to succeed.
 */
export const getGeminiRecoveryStrategy = createTracedOp(
  "getGeminiRecoveryStrategy",
  async function getGeminiRecoveryStrategy(
    pageUrl: string,
    targetDescription: string,
    failureContext: string,
    domSnippet?: string
  ): Promise<GeminiRecoveryStrategy> {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = [
      "You are a web-scraping recovery specialist.",
      "A browser automation agent failed to extract data from a web page.",
      "Analyse the failure and suggest a recovery strategy.",
      "",
      `Page URL: ${pageUrl}`,
      `Target data: ${targetDescription}`,
      `Failure context: ${failureContext}`,
      domSnippet
        ? `\nDOM snippet (first ~5 000 chars of cleaned body):\n${domSnippet}`
        : "",
      "",
      "Respond with ONLY a JSON object (no markdown fences) containing:",
      '  "suggestedSelector": a CSS selector most likely to contain the target data,',
      '  "action": one of "extract", "click_then_extract", "scroll_then_extract",',
      '  "reasoning": a one-sentence explanation of why this selector should work.',
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const parsed = JSON.parse(text) as GeminiRecoveryStrategy;
      return {
        suggestedSelector: parsed.suggestedSelector ?? "",
        action: parsed.action ?? "extract",
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      // If the model did not return valid JSON, try to extract JSON from the
      // response (it may have wrapped it in markdown code fences).
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiRecoveryStrategy;
        return {
          suggestedSelector: parsed.suggestedSelector ?? "",
          action: parsed.action ?? "extract",
          reasoning: parsed.reasoning ?? "",
        };
      }
      throw new Error(
        `Gemini returned unparseable response: ${text.substring(0, 200)}`
      );
    }
  },
  {
    callDisplayName: (
      _pageUrl: string,
      targetDescription: string
    ) => `gemini-recovery:${targetDescription.substring(0, 40)}`,
    summarize: (result: GeminiRecoveryStrategy) => ({
      "webscout.gemini_selector": result.suggestedSelector,
      "webscout.gemini_action": result.action,
    }),
  }
);

/**
 * Ask Gemini to analyse a page's DOM and recommend the best extraction
 * strategy before any attempt is made.
 */
export const geminiAnalyzePage = createTracedOp(
  "geminiAnalyzePage",
  async function geminiAnalyzePage(
    pageUrl: string,
    targetDescription: string,
    domSnippet: string
  ): Promise<GeminiPageAnalysis> {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = [
      "You are a web-scraping expert.",
      "Analyse the following DOM snippet and suggest the best strategy to",
      "extract the requested data.",
      "",
      `Page URL: ${pageUrl}`,
      `Target data: ${targetDescription}`,
      `\nDOM snippet (first ~5 000 chars of cleaned body):\n${domSnippet}`,
      "",
      "Respond with ONLY a JSON object (no markdown fences) containing:",
      '  "extractionStrategy": one of "css_selector", "text_content", "table_parse", "structured_data",',
      '  "suggestedSelectors": an array of 1-3 CSS selectors to try (best first),',
      '  "pageStructureSummary": a brief summary of the page layout,',
      '  "reasoning": why this strategy is recommended.',
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      const parsed = JSON.parse(text) as GeminiPageAnalysis;
      return {
        extractionStrategy: parsed.extractionStrategy ?? "css_selector",
        suggestedSelectors: parsed.suggestedSelectors ?? [],
        pageStructureSummary: parsed.pageStructureSummary ?? "",
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiPageAnalysis;
        return {
          extractionStrategy: parsed.extractionStrategy ?? "css_selector",
          suggestedSelectors: parsed.suggestedSelectors ?? [],
          pageStructureSummary: parsed.pageStructureSummary ?? "",
          reasoning: parsed.reasoning ?? "",
        };
      }
      throw new Error(
        `Gemini returned unparseable response: ${text.substring(0, 200)}`
      );
    }
  },
  {
    callDisplayName: (
      _pageUrl: string,
      targetDescription: string
    ) => `gemini-analyze:${targetDescription.substring(0, 40)}`,
    summarize: (result: GeminiPageAnalysis) => ({
      "webscout.gemini_strategy": result.extractionStrategy,
      "webscout.gemini_selectors_count": result.suggestedSelectors.length,
    }),
  }
);
