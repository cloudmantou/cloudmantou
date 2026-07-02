import { NextRequest } from "next/server";

/**
 * 轻量级内存速率限制器
 *
 * 基于 Map 存储，无外部依赖。
 * 进程重启后计数器重置（在多实例部署中应替换为 Redis 版本）。
 *
 * 过期清理策略：每次 rateLimit 调用时惰性清理过期条目，
 * 同时在条目数超过 MAX_ENTRIES 时触发全量清理，防止内存泄漏。
 */

type RateLimitEntry = {
  count: number;
  resetAt: number; // epoch ms
};

const MAX_ENTRIES = 10000;
const store = new Map<string, RateLimitEntry>();

/**
 * 清理过期的速率限制条目
 */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
};

/**
 * 检查速率限制
 *
 * @param identifier 唯一标识（IP 地址、用户 ID、邮箱等）
 * @param limit 时间窗口内允许的最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns 限流结果
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  // 惰性清理 + 溢出保护
  if (store.size > MAX_ENTRIES) {
    cleanupExpired();
  }

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // 新窗口或已过期
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { success: false, limit, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, limit, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * 从 NextRequest 提取客户端 IP 地址
 *
 * 优先级：x-forwarded-for > x-real-ip > cf-connecting-ip > fallback
 */
export function getClientIP(req: NextRequest | Request): string {
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

/**
 * 构建速率限制标识符
 *
 * 如果有用户 ID 则用用户 ID，否则用 IP
 */
export function getRateLimitIdentifier(
  req: NextRequest | Request,
  userId?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${getClientIP(req)}`;
}

// ===== 预设的速率限制策略 =====

export const RATE_LIMITS = {
  /** 登录：每 IP 每 15 分钟最多 10 次 */
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** 注册：每 IP 每小时最多 5 次 */
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** 点赞：每用户每分钟最多 30 次 */
  LIKE: { limit: 30, windowMs: 60 * 1000 },
  /** 评论：每用户每 10 分钟最多 10 条 */
  COMMENT: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** 卡密验证：每用户每 15 分钟最多 10 次 */
  CARD_VERIFY: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

/**
 * 检查速率限制并返回 429 响应（如果超限）
 *
 * 用法：
 * ```ts
 * const limited = checkRateLimit(req, RATE_LIMITS.COMMENT, userId);
 * if (limited) return limited;
 * ```
 */
export function checkRateLimit(
  req: NextRequest | Request,
  config: { limit: number; windowMs: number },
  userId?: string | null
): Response | null {
  const identifier = getRateLimitIdentifier(req, userId);
  const result = rateLimit(identifier, config.limit, config.windowMs);

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
