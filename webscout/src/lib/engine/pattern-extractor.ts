import type { PatternData } from "../utils/types";
import { extractUrlPattern } from "../utils/url";

export function buildPattern(
  url: string,
  target: string,
  workingSelector: string,
  approach: "extract" | "act" | "agent"
): PatternData {
  return {
    url_pattern: extractUrlPattern(url),
    target,
    working_selector: workingSelector,
    approach,
  };
}

export function isConfidentMatch(score: number): boolean {
  return score >= 0.85;
}

export function buildRefinedInstruction(
  originalTarget: string,
  failureContext: string
): string {
  return (
    `Previous attempt to extract "${originalTarget}" failed. ` +
    `Context: ${failureContext}. ` +
    `Look more carefully: main content, sidebars, tables, product details, ` +
    `pricing sections, metadata. Extract: ${originalTarget}`
  );
}
