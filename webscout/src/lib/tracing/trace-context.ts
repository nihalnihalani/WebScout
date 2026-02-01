import type { Page } from "@browserbasehq/stagehand";

export async function captureScreenshot(page: Page): Promise<string> {
  try {
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return buffer.toString("base64");
  } catch (error) {
    console.warn("[Trace] Screenshot failed:", (error as Error).message);
    return "";
  }
}

export async function captureDOMSnapshot(page: Page): Promise<string> {
  try {
    const html = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "<empty>";
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return clone.innerHTML.substring(0, 5000);
    });
    return html;
  } catch (error) {
    console.warn("[Trace] DOM snapshot failed:", (error as Error).message);
    return "<unavailable>";
  }
}

export function buildStepMetadata(
  url: string,
  target: string,
  attempt: number,
  extras?: Record<string, unknown>
) {
  return { url, target, attempt, timestamp: Date.now(), ...extras };
}
