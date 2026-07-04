import { rateLimit, RATE_LIMITS, type RateLimitResult } from "@/lib/rate-limit";

/** 登录限流：账号 + IP 双维度（内存实现，避免 auth 打包 ioredis） */
export function checkLoginRateLimit(
  ip: string,
  identifier: string
): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS.LOGIN;
  const normalizedId = identifier.trim().toLowerCase();
  const normalizedIp = ip.trim() || "unknown";

  const byId = rateLimit(`login:id:${normalizedId}`, limit, windowMs);
  if (!byId.success) return byId;

  const byIp = rateLimit(`login:ip:${normalizedIp}`, limit, windowMs);
  return byIp;
}