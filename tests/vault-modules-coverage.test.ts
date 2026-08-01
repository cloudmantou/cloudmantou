import type { VaultEntry } from "@prisma/client";
import { authenticator } from "otplib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildVaultWriteData,
  toVaultDetail,
  toVaultListItem,
  VAULT_TYPE_LABELS,
} from "@/lib/vault";
import {
  decryptVaultField,
  encryptVaultField,
  hasVaultSecret,
} from "@/lib/vault-crypto";
import {
  createVaultUnlockToken,
  VAULT_UNLOCK_COOKIE,
  VAULT_UNLOCK_TTL_MS,
  vaultUnlockCookieOptions,
  verifyVaultUnlockToken,
} from "@/lib/vault-session";
import {
  generateVaultTotpUri,
  getVaultTotpSecret,
  isVaultTotpConfigured,
  verifyVaultTotp,
} from "@/lib/vault-totp";

const ENV_KEYS = ["SETTINGS_ENCRYPTION_KEY", "AUTH_SECRET", "VAULT_TOTP_SECRET", "NODE_ENV"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else Reflect.set(process.env, key, value);
  }
}

function vaultRow(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    id: "vault-1",
    title: "Production API",
    type: "ACCOUNT",
    account: "operator@example.test",
    secretEnc: null,
    url: "https://example.test/login",
    contentEnc: null,
    remark: "primary",
    pinned: true,
    createdAt: new Date("2026-07-19T01:02:03.000Z"),
    updatedAt: new Date("2026-07-19T04:05:06.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = "vault-coverage-settings-key-32chars";
  process.env.AUTH_SECRET = "vault-coverage-auth-secret-32chars";
  process.env.VAULT_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
});

afterEach(restoreEnv);

describe("vault-crypto production helpers", () => {
  it("normalizes, encrypts, and decrypts non-empty fields", () => {
    const encrypted = encryptVaultField("  real secret  ");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptVaultField(encrypted)).toBe("real secret");
    expect(hasVaultSecret(encrypted)).toBe(true);
  });

  it.each([undefined, null, ""])("treats %j as an empty field", (value) => {
    expect(encryptVaultField(value)).toBeNull();
    expect(decryptVaultField(value)).toBe("");
    expect(hasVaultSecret(value)).toBe(false);
  });

  it("does not classify legacy whitespace as a stored secret", () => {
    expect(encryptVaultField("   ")).toBeNull();
    expect(hasVaultSecret("   ")).toBe(false);
  });
});

describe("vault entry mapping and writes", () => {
  it("maps list metadata without exposing encrypted fields", () => {
    const item = toVaultListItem(
      vaultRow({ secretEnc: "enc-value", contentEnc: "  ", pinned: false })
    );

    expect(item).toEqual({
      id: "vault-1",
      title: "Production API",
      type: "ACCOUNT",
      account: "operator@example.test",
      url: "https://example.test/login",
      remark: "primary",
      pinned: false,
      hasSecret: true,
      hasContent: false,
      createdAt: "2026-07-19T01:02:03.000Z",
      updatedAt: "2026-07-19T04:05:06.000Z",
    });
    expect(item).not.toHaveProperty("secretEnc");
    expect(item).not.toHaveProperty("contentEnc");
  });

  it("decrypts secret and content only for a detail response", () => {
    const secretEnc = encryptVaultField("api-secret");
    const contentEnc = encryptVaultField("private notes");
    const detail = toVaultDetail(vaultRow({ secretEnc, contentEnc }));

    expect(detail.secret).toBe("api-secret");
    expect(detail.content).toBe("private notes");
    expect(detail.hasSecret).toBe(true);
    expect(detail.hasContent).toBe(true);
  });

  it("trims public fields and encrypts supplied private fields", () => {
    const data = buildVaultWriteData({
      title: "  API account  ",
      type: "ACCOUNT",
      account: "  alice  ",
      url: "  https://example.test  ",
      remark: "  rotation due  ",
      pinned: true,
      secret: "  password  ",
      content: "  recovery codes  ",
    });

    expect(data).toMatchObject({
      title: "API account",
      type: "ACCOUNT",
      account: "alice",
      url: "https://example.test",
      remark: "rotation due",
      pinned: true,
    });
    expect(decryptVaultField(data.secretEnc)).toBe("password");
    expect(decryptVaultField(data.contentEnc)).toBe("recovery codes");
  });

  it("omits unchanged private fields during an update", () => {
    const existing = vaultRow({
      secretEnc: encryptVaultField("existing secret"),
      contentEnc: encryptVaultField("existing content"),
    });
    const data = buildVaultWriteData(
      { title: " Updated ", type: "NOTE", account: " ", url: null, remark: undefined },
      existing
    );

    expect(data).toEqual({
      title: "Updated",
      type: "NOTE",
      account: null,
      url: null,
      remark: null,
      pinned: false,
    });
    expect(data).not.toHaveProperty("secretEnc");
    expect(data).not.toHaveProperty("contentEnc");
  });

  it("explicit blank private fields clear stored ciphertext", () => {
    expect(
      buildVaultWriteData({
        title: "clear",
        type: "SECRET",
        secret: "  ",
        content: null,
      })
    ).toMatchObject({ secretEnc: null, contentEnc: null });

    expect(
      buildVaultWriteData({ title: "clear null", type: "SECRET", secret: null })
    ).toMatchObject({ secretEnc: null });
  });

  it("rejects masked placeholders instead of encrypting UI masks", () => {
    expect(() =>
      buildVaultWriteData({
        title: "masked",
        type: "SECRET",
        secret: "abcd••••wxyz",
      })
    ).toThrow(/masked/i);
  });

  it("exports a complete label for every Vault entry type", () => {
    expect(VAULT_TYPE_LABELS).toEqual({
      ACCOUNT: "账号密码",
      SECRET: "密钥令牌",
      NOTE: "保密笔记",
    });
  });
});

describe("vault unlock session", () => {
  it("creates a signed, user-bound token with the configured TTL", () => {
    const now = 1_750_000_000_000;
    const token = createVaultUnlockToken("admin-1", now);
    const [userId, expiresAt, signature] = token.split(".");

    expect(userId).toBe("admin-1");
    expect(Number(expiresAt)).toBe(now + VAULT_UNLOCK_TTL_MS);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyVaultUnlockToken(token, "admin-1", now + 1)).toBe(true);
    expect(VAULT_UNLOCK_COOKIE).toBe("vault_unlock");
  });

  it.each([
    [null, "admin-1", 1_000],
    ["broken", "admin-1", 1_000],
    ["admin-1.nope.deadbeef", "admin-1", 1_000],
    ["admin-1.2000.deadbeef", "other-admin", 1_000],
    ["admin-1.999.deadbeef", "admin-1", 1_000],
    ["admin-1.2000.deadbeef", "admin-1", 1_000],
  ] as const)("rejects invalid unlock token %j", (token, userId, now) => {
    expect(verifyVaultUnlockToken(token, userId, now)).toBe(false);
  });

  it("rejects a signature changed without changing token shape", () => {
    const token = createVaultUnlockToken("admin-1", 1_000);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(verifyVaultUnlockToken(tampered, "admin-1", 1_001)).toBe(false);
  });

  it("expires a token exactly at its expiry boundary", () => {
    const now = 1_000;
    const token = createVaultUnlockToken("admin-1", now);
    expect(verifyVaultUnlockToken(token, "admin-1", now + VAULT_UNLOCK_TTL_MS)).toBe(false);
  });

  it("requires AUTH_SECRET for token creation and signature verification", () => {
    delete process.env.AUTH_SECRET;
    expect(() => createVaultUnlockToken("admin-1", 1_000)).toThrow(/AUTH_SECRET/);
    expect(() =>
      verifyVaultUnlockToken("admin-1.2000." + "a".repeat(64), "admin-1", 1_000)
    ).toThrow(/AUTH_SECRET/);
  });

  it.each([
    ["development", false],
    ["production", true],
  ] as const)("uses secure=%s only in production", (nodeEnv, secure) => {
    Reflect.set(process.env, "NODE_ENV", nodeEnv);
    const options = vaultUnlockCookieOptions(2_000);
    expect(options).toEqual({
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      expires: new Date(2_000),
    });
  });
});

describe("vault TOTP", () => {
  it("fails closed when no secret is configured", () => {
    process.env.VAULT_TOTP_SECRET = "  ";
    expect(getVaultTotpSecret()).toBeNull();
    expect(isVaultTotpConfigured()).toBe(false);
    expect(verifyVaultTotp("123456")).toBe(false);
    expect(generateVaultTotpUri()).toBeNull();
  });

  it.each(["", "12345", "1234567", "12a456"])("rejects malformed code %j", (code) => {
    expect(verifyVaultTotp(code)).toBe(false);
  });

  it("normalizes whitespace and verifies a real TOTP", () => {
    const code = authenticator.generate("JBSWY3DPEHPK3PXP");
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

    expect(getVaultTotpSecret()).toBe("JBSWY3DPEHPK3PXP");
    expect(isVaultTotpConfigured()).toBe(true);
    expect(verifyVaultTotp(spaced)).toBe(true);
  });

  it("creates default and custom otpauth URIs", () => {
    expect(generateVaultTotpUri()).toContain("cloudmantou-vault");
    const custom = generateVaultTotpUri("Operations Vault");
    expect(custom).toContain("Operations%20Vault");
    expect(custom).toContain("issuer=CloudMantou");
  });
});
