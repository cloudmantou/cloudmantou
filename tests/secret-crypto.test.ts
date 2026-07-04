import { afterEach, beforeAll, describe, expect, it } from "vitest";

const ORIGINAL_SETTINGS_KEY = process.env.SETTINGS_ENCRYPTION_KEY;

let encryptSecret: typeof import("@/lib/secret-crypto").encryptSecret;
let decryptSecret: typeof import("@/lib/secret-crypto").decryptSecret;
let encryptGatewaySecrets: typeof import("@/lib/secret-crypto").encryptGatewaySecrets;
let decryptGatewaySecrets: typeof import("@/lib/secret-crypto").decryptGatewaySecrets;
let isEncryptedSecret: typeof import("@/lib/secret-crypto").isEncryptedSecret;

beforeAll(async () => {
  process.env.SETTINGS_ENCRYPTION_KEY = "test-settings-encryption-key-32chars!";
  const mod = await import("@/lib/secret-crypto");
  encryptSecret = mod.encryptSecret;
  decryptSecret = mod.decryptSecret;
  encryptGatewaySecrets = mod.encryptGatewaySecrets;
  decryptGatewaySecrets = mod.decryptGatewaySecrets;
  isEncryptedSecret = mod.isEncryptedSecret;
});

afterEach(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = ORIGINAL_SETTINGS_KEY ?? "test-settings-encryption-key-32chars!";
});

describe("secret-crypto", () => {
  it("encrypts and decrypts gateway secrets with SETTINGS_ENCRYPTION_KEY", () => {
    const encrypted = encryptSecret("my-private-key-value");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("my-private-key-value");
  });

  it("keeps masked placeholder untouched", () => {
    expect(encryptSecret("abcd••••••••wxyz")).toBe("abcd••••••••wxyz");
  });

  it("does not treat enc:v1: prefixed plaintext as already encrypted before trim", () => {
    const value = "enc:v1:not-really-encrypted";
    expect(isEncryptedSecret(value)).toBe(true);
    expect(encryptSecret(value)).toBe(value);
  });

  it("encrypts only sensitive gateway fields", () => {
    const encrypted = encryptGatewaySecrets({
      alipay: {
        enabled: true,
        appId: "app-123",
        privateKey: "secret-private",
      },
    });

    expect(encrypted.alipay.appId).toBe("app-123");
    expect(isEncryptedSecret(String(encrypted.alipay.privateKey))).toBe(true);

    const decrypted = decryptGatewaySecrets(encrypted);
    expect(decrypted.alipay.privateKey).toBe("secret-private");
  });
});