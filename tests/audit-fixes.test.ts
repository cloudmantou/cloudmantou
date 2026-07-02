import { describe, expect, it, afterEach, vi } from "vitest";
import { rateLimit, checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

/**
 * 安全审计修复验证测试 — 速率限制器 (rate-limit.ts)
 *
 * 覆盖三个核心行为：
 * 1. 时间窗口内允许请求（remaining 递减）
 * 2. 超出限制后拒绝请求（success=false, remaining=0）
 * 3. 窗口过期后计数器重置（新一轮窗口允许请求）
 */

// 使用唯一标识符避免模块级 Map 状态污染
function uniqueId(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("rateLimit — 时间窗口内允许请求", () => {
  it("在 limit 以内的请求全部返回 success=true 且 remaining 递减", () => {
    const id = uniqueId("allow");
    const limit = 5;
    const windowMs = 60_000;

    for (let i = 0; i < limit; i++) {
      const result = rateLimit(id, limit, windowMs);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(limit);
      expect(result.remaining).toBe(limit - 1 - i);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    }
  });

  it("首次请求的 remaining 等于 limit-1", () => {
    const id = uniqueId("first");
    const result = rateLimit(id, 10, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
  });
});

describe("rateLimit — 超出限制后拒绝请求", () => {
  it("超出 limit 后返回 success=false 且 remaining=0", () => {
    const id = uniqueId("deny");
    const limit = 3;
    const windowMs = 60_000;

    // 耗尽配额
    for (let i = 0; i < limit; i++) {
      const r = rateLimit(id, limit, windowMs);
      expect(r.success).toBe(true);
    }

    // 第 limit+1 次请求应被拒绝
    const denied = rateLimit(id, limit, windowMs);
    expect(denied.success).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.limit).toBe(limit);
  });

  it("被拒绝后继续请求仍然返回 success=false（不会泄漏配额）", () => {
    const id = uniqueId("leak");
    const limit = 2;

    for (let i = 0; i < limit; i++) {
      rateLimit(id, limit, 60_000);
    }

    for (let i = 0; i < 5; i++) {
      const r = rateLimit(id, limit, 60_000);
      expect(r.success).toBe(false);
      expect(r.remaining).toBe(0);
    }
  });
});

describe("rateLimit — 窗口过期后计数器重置", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("窗口过期后新一轮窗口重新允许请求", () => {
    vi.useFakeTimers();
    const startTime = Date.now();
    vi.setSystemTime(startTime);

    const id = uniqueId("reset");
    const limit = 2;
    const windowMs = 1_000;

    // 耗尽配额
    rateLimit(id, limit, windowMs);
    rateLimit(id, limit, windowMs);

    // 此时应该被拒绝
    expect(rateLimit(id, limit, windowMs).success).toBe(false);

    // 时间推进超过窗口
    vi.setSystemTime(startTime + windowMs + 1);

    // 新窗口应该重新允许
    const result = rateLimit(id, limit, windowMs);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it("窗口内多次请求共享同一个 resetAt", () => {
    vi.useFakeTimers();
    const startTime = Date.now();
    vi.setSystemTime(startTime);

    const id = uniqueId("shared-reset");
    const windowMs = 5_000;

    const first = rateLimit(id, 10, windowMs);
    const second = rateLimit(id, 10, windowMs);

    // 同一窗口内 resetAt 应一致
    expect(first.resetAt).toBe(second.resetAt);
  });
});

describe("checkRateLimit — 返回 429 响应", () => {
  it("超限时返回 429 状态码和 Retry-After 头", async () => {
    const id = uniqueId("checkrl");
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": id },
    });

    // 用极小窗口和 limit=1 快速触发限流
    const config = { limit: 1, windowMs: 60_000 };
    const first = checkRateLimit(req, config);
    expect(first).toBeNull(); // 第一次允许

    const second = checkRateLimit(req, config);
    expect(second).not.toBeNull();
    expect(second!.status).toBe(429);
    expect(second!.headers.get("Retry-After")).not.toBeNull();
    expect(second!.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(second!.headers.get("X-RateLimit-Remaining")).toBe("0");

    const body = await second!.json();
    expect(body.code).toBe(42900);
  });

  it("未超限时返回 null", () => {
    const id = uniqueId("checkrl-ok");
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": id },
    });
    const result = checkRateLimit(req, { limit: 100, windowMs: 60_000 });
    expect(result).toBeNull();
  });
});

describe("getClientIP — 客户端 IP 提取", () => {
  it("优先使用 x-forwarded-for 的第一个 IP", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIP(req)).toBe("1.2.3.4");
  });

  it("回退到 x-real-ip", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIP(req)).toBe("9.9.9.9");
  });

  it("无 IP 头时返回 unknown", () => {
    const req = new NextRequest("http://localhost");
    expect(getClientIP(req)).toBe("unknown");
  });
});
