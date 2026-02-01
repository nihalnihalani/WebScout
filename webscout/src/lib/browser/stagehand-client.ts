import { Stagehand } from "@browserbasehq/stagehand";

export async function createStagehand(): Promise<Stagehand> {
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error(
      "BROWSERBASE_API_KEY is not set. Get your API key from https://www.browserbase.com/settings"
    );
  }
  if (!process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error(
      "BROWSERBASE_PROJECT_ID is not set. Find your project ID in the Browserbase dashboard."
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Get your API key from https://platform.openai.com/api-keys"
    );
  }

  try {
    const stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: "openai/gpt-4o",
      // Disable verbose logging (pino-pretty) for serverless compatibility
      verbose: 0,
    });

    await stagehand.init();
    console.log("[Stagehand] Initialized with Browserbase");
    return stagehand;
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      throw new Error(
        `Browserbase authentication failed. Verify your BROWSERBASE_API_KEY is correct. Original: ${msg}`
      );
    }
    if (msg.includes("project")) {
      throw new Error(
        `Invalid Browserbase project. Verify BROWSERBASE_PROJECT_ID. Original: ${msg}`
      );
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      throw new Error(
        `Cannot reach Browserbase. Check your internet connection. Original: ${msg}`
      );
    }
    throw new Error(
      `Failed to create browser session: ${msg}. Check BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.`
    );
  }
}

export async function closeStagehand(stagehand: Stagehand): Promise<void> {
  try {
    await stagehand.close();
    console.log("[Stagehand] Session closed");
  } catch (error) {
    console.warn("[Stagehand] Error closing session:", (error as Error).message);
  }
}
