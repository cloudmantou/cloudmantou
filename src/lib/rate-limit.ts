import { NextRequest } from "next/server";
import { memoryRateLimit, type RateLimitResult } from "@/lib/rate-limit-memory";

export type { RateLimitResult };
export { memoryRateLimit };

/**
 * 同步内存限流（middleware 安全，不引入 ioredis）。
 * 生产多实例限流请使用 rate-limit-server.ts 中的 async 版本。
 */

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  return memoryRateLimit(identifier, limit, windowMs);
}

function trustProxyHeaders(): boolean {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

export function getClientIP(req: NextRequest | Request): string {
  if (!trustProxyHeaders()) {
    return "unknown";
  }

  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP.trim();
  }
  return "unknown";
}

export function getRateLimitIdentifier(
  req: NextRequest | Request,
  userId?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${getClientIP(req)}`;
}

export const RATE_LIMITS = {
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  LIKE: { limit: 30, windowMs: 60 * 1000 },
  COMMENT: { limit: 10, windowMs: 10 * 60 * 1000 },
  CARD_VERIFY: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;