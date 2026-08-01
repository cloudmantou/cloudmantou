import { createHash } from "node:crypto";
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

  // Check the bounded IP bucket first. Once an IP is denied, attacker-controlled
  // identifiers can no longer allocate additional buckets.
  const byIp = await rateLimitAsync(`login:ip:${ip}`, limit, windowMs);
  if (!byIp.success) return byIp;

  const identifierHash = createHash("sha256").update(normalizedId).digest("hex");
  return rateLimitAsync(`login:id:${identifierHash}`, limit, windowMs);
}
