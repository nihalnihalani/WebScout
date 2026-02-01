import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectionPromise: Promise<RedisClient> | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (client && client.isOpen) {
    return client;
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = (async () => {
    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    client.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
    client.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });
    await client.connect();
    console.log("[Redis] Connected successfully");
    connectionPromise = null;
    return client;
  })();
  return connectionPromise;
}

export async function disconnectRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.disconnect();
    client = null;
  }
}
