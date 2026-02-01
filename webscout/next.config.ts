import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "redis",
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
    "weave",
  ],
};

export default nextConfig;
