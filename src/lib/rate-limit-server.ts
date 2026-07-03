import { NextRequest } from "next/server";
import {
  getClientIP,
  getRateLimitIdentifier,
  memoryRateLimit,
  RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { getRedisClient } from "@/lib/redis";

export { RATE_LIMITS, getClientIP, getRateLimitIdentifier };

async function redisRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }

    const key = `rl:${identifier}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    const resetAt = Date.now() + (ttl > 0 ? ttl : windowMs);

    if (count > limit) {
      return { success: false, limit, remaining: 0, resetAt };
    }

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch (err) {
    console.warn("[rate-limit] Redis unavailable, using memory store:", err);
    return null;
  }
}

export async function rateLimitAsync(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisResult = await redisRateLimit(identifier, limit, windowMs);
  if (redisResult) return redisResult;
  return memoryRateLimit(identifier, limit, windowMs);
}

export async function checkRateLimit(
  req: NextRequest | Request,
  config: { limit: number; windowMs: number },
  userId?: string | null
): Promise<Response | null> {
  const identifier = getRateLimitIdentifier(req, userId);
  const result = await rateLimitAsync(identifier, config.limit, config.windowMs);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        code: 42900,
        message: `请求过于频繁，请 ${retryAfter} 秒后重试`,
        data: null,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
        },
      }
    );
  }

  return null;
}