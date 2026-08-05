import { generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import { isPemEncoded } from "@/lib/payment-config";
import { createAlipayPayment } from "@/lib/payment-providers";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "der" },
  publicKeyEncoding: { type: "spki", format: "der" },
});
const PKCS8_PRIVATE = privateKey.toString("base64");
const SPKI_PUBLIC = publicKey.toString("base64");

describe("isPemEncoded", () => {
  it("detects PEM headers only at line start", () => {
    expect(isPemEncoded("-----BEGIN PRIVATE KEY-----\nabc")).toBe(true);
    expect(isPemEncoded(PKCS8_PRIVATE)).toBe(false);
    expect(isPemEncoded("notBEGIN but has BEGIN in text")).toBe(false);
  });
});

describe("Alipay PKCS#8 private key", () => {
  it("builds signed sandbox form with OPEN platform PKCS#8 key", () => {
    const result = createAlipayPayment({
      config: {
        enabled: true,
        env: "sandbox",
        appId: "2021000000000000",
        privateKey: PKCS8_PRIVATE,
        publicKey: SPKI_PUBLIC,
      },
      mode: "page",
      orderNo: "ORD-SANDBOX-001",
      title: "沙箱测试",
      amount: 0.01,
      notifyUrl: "http://localhost:3000/api/payment/notify/alipay",
      returnUrl: "http://localhost:3000/payment/result",
      scriptNonce: "pem-test-nonce",
    });

    expect(result.type).toBe("form");
    if (result.type === "form") {
      const action = result.html.match(/<form[^>]+action="([^"]+)"/)?.[1];
      expect(result.html).toContain("openapi-sandbox.dl.alipaydev.com");
      expect(action).toContain("charset=utf-8");
      expect(action).toContain("sign=");
      expect(result.html).not.toContain('name="sign"');
      expect(result.html).toContain('name="biz_content"');
    }
  });
});
