import { NextRequest } from "next/server";
import {
  memoryRateLimit,
  memoryRateLimitRefund,
  type RateLimitResult,
} from "@/lib/rate-limit-memory";

export type { RateLimitResult };
export { memoryRateLimit, memoryRateLimitRefund };

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

/** 受信任的反向代理层数（X-Forwarded-For 从右往左数第 N 个为客户端 IP），默认 1 */
function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10);
  return Number.isInteger(hops) && hops > 0 ? hops : 1;
}

/**
 * 仅在 TRUST_PROXY_HEADERS=true 时读取代理头。
 * X-Real-IP 由代理以 $remote_addr 覆盖写入，优先使用；X-Forwarded-For 最左侧可被客户端伪造，
 * 因此只取最右侧由受信任代理追加的条目。
 */
export function getClientIP(req: NextRequest | Request): string {
  if (!trustProxyHeaders()) {
    return "unknown";
  }

  const headers = req.headers;
  const realIP = headers.get("x-real-ip")?.trim();
  if (realIP) {
    return realIP;
  }
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (forwarded?.length) {
    return forwarded[Math.max(0, forwarded.length - trustedProxyHops())];
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