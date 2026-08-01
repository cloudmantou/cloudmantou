import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ rateLimited: false }));
const verifyVaultTotp = vi.hoisted(() => vi.fn(() => true));
const setCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/guards", () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public code: number,
      public status: number
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } })),
  };
});

vi.mock("@/lib/rate-limit-server", () => ({
  checkRateLimit: vi.fn(async () =>
    state.rateLimited ? new Response("limited", { status: 429 }) : null
  ),
}));

vi.mock("@/lib/vault-totp", () => ({
  isVaultTotpConfigured: () => true,
  verifyVaultTotp,
}));

vi.mock("@/lib/vault-session", () => ({
  createVaultUnlockToken: () => "unlock-token",
  vaultUnlockCookieOptions: () => ({ httpOnly: true }),
  VAULT_UNLOCK_COOKIE: "vault_unlock",
  VAULT_UNLOCK_TTL_MS: 900_000,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setCookie })),
}));

vi.mock("@/lib/admin-audit-log", () => ({
  auditAdminAction: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/admin/vault/verify/route";

function verifyRequest() {
  return new NextRequest("https://example.test/api/admin/vault/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "123456" }),
  });
}

describe("Vault verification rate limit", () => {
  beforeEach(() => {
    state.rateLimited = false;
    verifyVaultTotp.mockClear();
    setCookie.mockClear();
  });

  it("short-circuits before TOTP verification when the admin/IP bucket is limited", async () => {
    state.rateLimited = true;

    const response = await POST(verifyRequest());

    expect(response.status).toBe(429);
    expect(verifyVaultTotp).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("preserves successful verification below the limit", async () => {
    const response = await POST(verifyRequest());

    expect(response.status).toBe(200);
    expect(verifyVaultTotp).toHaveBeenCalledWith("123456");
    expect(setCookie).toHaveBeenCalledOnce();
  });
});
