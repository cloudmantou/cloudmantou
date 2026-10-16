import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getClientIP, RATE_LIMITS, type RateLimitResult } from "@/lib/rate-limit";
import { rateLimitAsync, rateLimitRefundAsync } from "@/lib/rate-limit-server";

function loginRateLimitKeys(req: NextRequest | Request, identifier: string) {
  const normalizedId = identifier.trim().toLowerCase();
  const ip = getClientIP(req).trim() || "unknown";
  const identifierHash = createHash("sha256").update(normalizedId).digest("hex");
  return { ipKey: `login:ip:${ip}`, idKey: `login:id:${identifierHash}` };
}

/**
 * 登录限流：Redis 优先，账号 + IP 双维度。
 * 每次尝试先原子占用配额，登录成功后调用 refundLoginRateLimitServer 退还，
 * 因此窗口内只累计失败（及被拒）的尝试。
 */
export async function checkLoginRateLimitServer(
  req: NextRequest | Request,
  identifier: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS.LOGIN;
  const { ipKey, idKey } = loginRateLimitKeys(req, identifier);

  // Check the bounded IP bucket first. Once an IP is denied, attacker-controlled
  // identifiers can no longer allocate additional buckets.
  const byIp = await rateLimitAsync(ipKey, limit, windowMs);
  if (!byIp.success) return byIp;

  return rateLimitAsync(idKey, limit, windowMs);
}

/** 登录成功：退还本次尝试在 IP 与账号两个桶中占用的配额。 */
export async function refundLoginRateLimitServer(
  req: NextRequest | Request,
  identifier: string
): Promise<void> {
  const { ipKey, idKey } = loginRateLimitKeys(req, identifier);
  await Promise.all([rateLimitRefundAsync(ipKey), rateLimitRefundAsync(idKey)]);
}
