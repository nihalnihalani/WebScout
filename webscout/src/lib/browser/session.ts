import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

export async function createBrowserSession() {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  console.log(`[Browserbase] Session created: ${session.id}`);
  return session;
}

export function getSessionDebugUrl(sessionId: string): string {
  return `https://www.browserbase.com/sessions/${sessionId}`;
}
