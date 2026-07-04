import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { authenticator } from "otplib";
import { verifyVaultTotp, isVaultTotpConfigured } from "@/lib/vault-totp";
import {
  createVaultUnlockToken,
  verifyVaultUnlockToken,
  VAULT_UNLOCK_TTL_MS,
} from "@/lib/vault-session";

describe("vault TOTP", () => {
  const original = process.env.VAULT_TOTP_SECRET;

  beforeEach(() => {
    process.env.VAULT_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.VAULT_TOTP_SECRET;
    else process.env.VAULT_TOTP_SECRET = original;
  });

  it("detects configured secret", () => {
    expect(isVaultTotpConfigured()).toBe(true);
  });

  it("verifies valid TOTP code", () => {
    const code = authenticator.generate("JBSWY3DPEHPK3PXP");
    expect(verifyVaultTotp(code)).toBe(true);
    expect(verifyVaultTotp("000000")).toBe(false);
  });
});

describe("vault unlock token", () => {
  const originalAuth = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-minimum!!";
  });

  afterEach(() => {
    if (originalAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuth;
  });

  it("creates and verifies unlock token", () => {
    const now = Date.now();
    const token = createVaultUnlockToken("user-1", now);
    expect(verifyVaultUnlockToken(token, "user-1", now)).toBe(true);
    expect(verifyVaultUnlockToken(token, "user-2", now)).toBe(false);
    expect(verifyVaultUnlockToken(token, "user-1", now + VAULT_UNLOCK_TTL_MS + 1)).toBe(
      false
    );
  });
});