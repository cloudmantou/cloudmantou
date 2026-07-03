import Redis from "ioredis";

let client: Redis | null = null;
let connectFailed = false;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url || connectFailed) return null;

  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      console.warn("[Redis] connection error, falling back to memory rate limit:", err.message);
      connectFailed = true;
    });
  }

  return client;
}

export async function redisPing(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    connectFailed = true;
    return false;
  }
}