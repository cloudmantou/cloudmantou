import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  encryptGatewaySecrets,
  decryptGatewaySecrets,
  isEncryptedSecret,
} from "@/lib/secret-crypto";

const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;

afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
});

describe("secret-crypto", () => {
  it("encrypts and decrypts gateway secrets with AUTH_SECRET", () => {
    process.env.AUTH_SECRET = "test-secret-for-encryption-32chars!";
    const encrypted = encryptSecret("my-private-key-value");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("my-private-key-value");
  });

  it("keeps masked placeholder untouched", () => {
    process.env.AUTH_SECRET = "test-secret-for-encryption-32chars!";
    expect(encryptSecret("abcd••••••••wxyz")).toBe("abcd••••••••wxyz");
  });

  it("encrypts only sensitive gateway fields", () => {
    process.env.AUTH_SECRET = "test-secret-for-encryption-32chars!";
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