import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: false,
  unlockValid: false,
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } })),
}));

vi.mock("@/lib/vault-totp", () => ({
  isVaultTotpConfigured: () => state.configured,
}));

vi.mock("@/lib/vault-session", () => ({
  VAULT_UNLOCK_COOKIE: "vault_unlock",
  verifyVaultUnlockToken: () => state.unlockValid,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: "signed-token" }),
  })),
}));

vi.mock("@/lib/admin-audit-log", () => ({
  auditAdminAction: vi.fn(async () => undefined),
}));

import { requireVaultUnlock } from "@/lib/guards";

describe("requireVaultUnlock", () => {
  beforeEach(() => {
    state.configured = false;
    state.unlockValid = false;
  });

  it("fails closed when Vault TOTP is not configured", async () => {
    await expect(requireVaultUnlock()).rejects.toMatchObject({
      status: 503,
    });
  });

  it("allows an administrator with configured TOTP and a valid unlock token", async () => {
    state.configured = true;
    state.unlockValid = true;

    await expect(requireVaultUnlock()).resolves.toMatchObject({
      user: { id: "admin-1", role: "ADMIN" },
    });
  });
});
