import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  buildAlipayLaunchContentSecurityPolicy,
  buildContentSecurityPolicy,
} from "@/config/csp";
import { checkLoginRateLimit } from "@/lib/login-rate-limit";
import { isAllowedAdminMutationOrigin } from "@/lib/csrf-origin";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function uniqueId(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("buildContentSecurityPolicy", () => {
  it("支付宝启动页只允许同一 nonce 的自动提交脚本", () => {
    const csp = buildAlipayLaunchContentSecurityPolicy("launch123");
    expect(csp).toContain("script-src 'nonce-launch123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("支付宝 form-action 同时允许官方电脑、H5 与沙箱收银台重定向", () => {
    const csp = buildAlipayLaunchContentSecurityPolicy("launch123");
    const formAction =
      csp.split(";").find((part) => part.trim().startsWith("form-action")) ?? "";
    const globalFormAction =
      buildContentSecurityPolicy("global123", false)
        .split(";")
        .find((part) => part.trim().startsWith("form-action")) ?? "";

    expect(formAction.trim().split(/\s+/)).toEqual([
      "form-action",
      "'self'",
      "https://openapi.alipay.com",
      "https://unitradeprod.alipay.com",
      "https://excashier.alipay.com",
      "https://mclient.alipay.com",
      "https://openapi.alipaydev.com",
      "https://openapi-sandbox.dl.alipaydev.com",
      "https://unitradeprod-sandbox.dl.alipaydev.com",
      "https://excashier-sandbox.dl.alipaydev.com",
      "https://mobileclientgw-sandbox.dl.alipaydev.com",
    ]);
    expect(globalFormAction.trim()).toBe(formAction.trim());
  });

  it("生产环境 script 使用 nonce 且不含 unsafe-inline", () => {
    const csp = buildContentSecurityPolicy("abc123", false);
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("开发环境保留 inline/eval 以兼容 HMR 与 React DevTools", () => {
    const csp = buildContentSecurityPolicy("abc123", true);
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'nonce-");
  });
});

describe("checkLoginRateLimit — 账号 + IP 双维度", () => {
  it("同一 IP 满额后任意账号都会被拒", () => {
    const ip = uniqueId("ip");
    const { limit } = RATE_LIMITS.LOGIN;

    for (let i = 0; i < limit; i++) {
      expect(checkLoginRateLimit(ip, `user-${i}`).success).toBe(true);
    }

    expect(checkLoginRateLimit(ip, `user-new-${Date.now()}`).success).toBe(false);
    expect(checkLoginRateLimit(`other-ip-${Date.now()}`, `user-new-${Date.now()}`).success).toBe(
      true
    );
  });

  it("同一账号满额后换 IP 仍会被拒", () => {
    const user = uniqueId("user");
    const { limit } = RATE_LIMITS.LOGIN;

    for (let i = 0; i < limit; i++) {
      expect(checkLoginRateLimit(`ip-${i}`, user).success).toBe(true);
    }

    expect(checkLoginRateLimit(`ip-new-${Date.now()}`, user).success).toBe(false);
    expect(checkLoginRateLimit(`ip-new-${Date.now()}`, `other-${Date.now()}`).success).toBe(true);
  });

  it("耗尽 IP 配额后拒绝", () => {
    const ip = uniqueId("blocked-ip");
    const user = uniqueId("user");
    const { limit } = RATE_LIMITS.LOGIN;

    for (let i = 0; i < limit; i++) {
      rateLimit(`login:ip:${ip}`, limit, RATE_LIMITS.LOGIN.windowMs);
    }

    expect(checkLoginRateLimit(ip, user).success).toBe(false);
  });
});

describe("isAllowedAdminMutationOrigin", () => {
  const originalAuthUrl = process.env.AUTH_URL;

  afterEach(() => {
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = originalAuthUrl;
    }
  });

  it("允许与 AUTH_URL 同源的 Origin", () => {
    process.env.AUTH_URL = "http://localhost:3000";
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(true);
  });

  it("拒绝跨站 Origin", () => {
    process.env.AUTH_URL = "http://localhost:3000";
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: {
        origin: "https://evil.example",
        host: "localhost:3000",
      },
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(false);
  });

  it("拒绝主机名相同但协议不同的 Origin", () => {
    process.env.AUTH_URL = "https://example.com";
    const req = new NextRequest("https://example.com/api/admin/settings", {
      method: "PUT",
      headers: {
        origin: "http://example.com",
        host: "example.com",
      },
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(false);
  });

  it("拒绝主机名相同但端口不同的 Origin", () => {
    process.env.AUTH_URL = "https://example.com";
    const req = new NextRequest("https://example.com/api/admin/settings", {
      method: "PUT",
      headers: {
        origin: "https://example.com:4444",
        host: "example.com",
      },
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(false);
  });
});
