import type { NextRequest } from "next/server";
import { getClientIP, RATE_LIMITS, type RateLimitResult } from "@/lib/rate-limit";
import { rateLimitAsync } from "@/lib/rate-limit-server";

/** 登录限流：Redis 优先，账号 + IP 双维度 */
export async function checkLoginRateLimitServer(
  req: NextRequest | Request,
  identifier: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS.LOGIN;
  const normalizedId = identifier.trim().toLowerCase();
  const ip = getClientIP(req).trim() || "unknown";

  const byId = await rateLimitAsync(`login:id:${normalizedId}`, limit, windowMs);
  if (!byId.success) return byId;

  return rateLimitAsync(`login:ip:${ip}`, limit, windowMs);
}