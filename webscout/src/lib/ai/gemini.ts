import { GoogleGenerativeAI } from "@google/generative-ai";
import { createTracedOp } from "../tracing/weave";

// ---------------------------------------------------------------------------
// Gemini client singleton
// ---------------------------------------------------------------------------

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    // Prefer GOOGLE_AI_API_KEY as explicitly requested by user configuration
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY (or GOOGLE_API_KEY) is not set. " +
        "Get one at https://aistudio.google.com/apikey"
      );
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Helper to generate content with retry logic and fallback to stable model on overload.
 */
async function generateWithFallback(
  primaryModelName: string,
  prompt: any, // Typed broadly to accept string | Part[] | etc.
  retries = 2
) {
  const fallbackModelName = "gemini-2.0-flash";
  let currentModelName = primaryModelName;
  let attempts = 0;

  while (true) {
    try {
      const model = getGenAI().getGenerativeModel({ model: currentModelName });
      return await model.generateContent(prompt);
    } catch (error: any) {
      attempts++;
      const msg = error.message || "";
      const isTransient = msg.includes("503") || msg.includes("overloaded") || msg.includes("429");

      if (isTransient) {
        console.warn(`[Gemini] Error with ${currentModelName} (Attempt ${attempts}): ${msg}`);

        // If overloaded, try falling back to stable model immediately if we haven't already
        if ((msg.includes("503") || msg.includes("overloaded")) && currentModelName !== fallbackModelName) {
          console.warn(`[Gemini] Switching fallback from ${currentModelName} to ${fallbackModelName}`);
          currentModelName = fallbackModelName;
          continue;
        }

        // Otherwise retry with backoff if we have retries left
        if (attempts <= retries) {
          const delay = 1000 * attempts;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
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

export interface GeminiScreenshotAnalysis {
  visualElements: string[];
  suggestedApproach: string;
  confidence: number;
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
    // Model selection handled by helper

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

    const result = await generateWithFallback("gemini-3-flash-preview", prompt);
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
    // Model selection handled by helper

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

    const result = await generateWithFallback("gemini-3-flash-preview", prompt);
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

/**
 * Use Gemini's multimodal capabilities to analyse a screenshot of a page
 * and identify visual elements relevant to the extraction target.
 *
 * This leverages Gemini's vision model — a capability unique to the Gemini
 * integration in this project (OpenAI is only used for embeddings).
 */
export const geminiAnalyzeScreenshot = createTracedOp(
  "geminiAnalyzeScreenshot",
  async function geminiAnalyzeScreenshot(
    screenshotBase64: string,
    targetDescription: string
  ): Promise<GeminiScreenshotAnalysis> {
    // Model selection handled by helper

    const prompt = [
      "You are a visual web-page analysis expert.",
      "You are given a screenshot of a web page and a description of the data",
      "a user wants to extract from it.",
      "",
      `Target data: ${targetDescription}`,
      "",
      "Analyse the visual layout and respond with ONLY a JSON object (no markdown fences) containing:",
      '  "visualElements": an array of strings describing the key UI elements visible on the page that are relevant to the target data (e.g. "table with 3 columns", "card grid", "sidebar navigation"),',
      '  "suggestedApproach": a brief recommendation on how to extract the target data based on the visual layout,',
      '  "confidence": a number between 0 and 1 indicating how confident you are that the target data is visible on the page.',
    ].join("\n");

    const result = await generateWithFallback("gemini-3-flash-preview", [
      prompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: screenshotBase64,
        },
      },
    ]);
    const text = result.response.text().trim();

    try {
      const parsed = JSON.parse(text) as GeminiScreenshotAnalysis;
      return {
        visualElements: parsed.visualElements ?? [],
        suggestedApproach: parsed.suggestedApproach ?? "",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiScreenshotAnalysis;
        return {
          visualElements: parsed.visualElements ?? [],
          suggestedApproach: parsed.suggestedApproach ?? "",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        };
      }
      throw new Error(
        `Gemini returned unparseable response: ${text.substring(0, 200)}`
      );
    }
  },
  {
    callDisplayName: (
      _screenshotBase64: string,
      targetDescription: string
    ) => `gemini-screenshot:${targetDescription.substring(0, 40)}`,
    summarize: (result: GeminiScreenshotAnalysis) => ({
      "webscout.gemini_visual_elements": result.visualElements.length,
      "webscout.gemini_visual_confidence": result.confidence,
    }),
  }
);
