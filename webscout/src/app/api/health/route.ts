import { NextResponse } from "next/server";
import { createClient } from "redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  const services: Record<
    string,
    { status: string; message: string; latency_ms?: number }
  > = {};
  const configuration: Record<string, string> = {};

  // Check Redis

  try {
    const redisStart = Date.now();
    const client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    await client.connect();
    await client.ping();

    // Also check if vector index exists
    let indexStatus = "unknown";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = await client.ft.info("idx:page_patterns") as any;
      const numDocs = info.num_docs ?? info.numDocs ?? 0;
      indexStatus = `active (${numDocs} docs)`;
    } catch {
      indexStatus = "not created yet";
    }

    await client.disconnect();

    services.redis = {
      status: "ok",
      message: `Connected. Vector index: ${indexStatus}`,
      latency_ms: Date.now() - redisStart,
    };
  } catch (e) {
    services.redis = {
      status: "error",
      message: `Connection failed: ${(e as Error).message}`,
    };
  }

  // Check API key configuration

  const keys = {
    browserbase_api_key: "BROWSERBASE_API_KEY",
    browserbase_project_id: "BROWSERBASE_PROJECT_ID",
    openai_api_key: "OPENAI_API_KEY",
    redis_url: "REDIS_URL",
    wandb_api_key: "WANDB_API_KEY",
    weave_project: "WEAVE_PROJECT",
    app_url: "NEXT_PUBLIC_APP_URL",
  };

  for (const [label, envVar] of Object.entries(keys)) {
    configuration[label] = process.env[envVar] ? "configured" : "missing";
  }

  // Overall status

  const allServicesOk = Object.values(services).every(
    (s) => s.status === "ok"
  );
  const allKeysConfigured = Object.values(configuration).every(
    (v) => v === "configured"
  );
  const overallStatus =
    allServicesOk && allKeysConfigured ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      response_time_ms: Date.now() - startTime,
      services,
      configuration,
      version: "0.1.0",
    },
    { status: overallStatus === "healthy" ? 200 : 503 }
  );
}
