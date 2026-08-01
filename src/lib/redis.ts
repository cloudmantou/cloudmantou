import Redis from "ioredis";

let client: Redis | null = null;

function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  });

  redis.on("error", (err) => {
    // ioredis reconnects in the background. Keep the singleton available so a
    // transient outage cannot disable distributed rate limiting until restart.
    console.warn("[Redis] connection error; retrying:", err.message);
  });

  return redis;
}

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (!client || client.status === "end") {
    client = createRedisClient(url);
  }

  return client;
}

export async function redisPing(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
