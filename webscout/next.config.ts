import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "redis",
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
    "weave",
    "pino",
    "pino-pretty",
  ],
};

export default nextConfig;
