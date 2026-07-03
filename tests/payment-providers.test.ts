import { describe, expect, it } from "vitest";
import { createAlipayPayment } from "@/lib/payment-providers";

describe("payment providers", () => {
  it("builds alipay page pay form with signed params", () => {
    const { privateKey, publicKey } = generateTestKeyPair();
    const result = createAlipayPayment({
      config: {
        enabled: true,
        env: "sandbox",
        appId: "2021000000000000",
        privateKey,
        publicKey,
      },
      mode: "page",
      orderNo: "ORD202601010001",
      title: "月度会员",
      amount: 29,
      notifyUrl: "https://example.com/api/payment/notify/alipay",
      returnUrl: "https://example.com/payment/result?orderNo=ORD202601010001",
    });

    expect(result.type).toBe("form");
    if (result.type === "form") {
      expect(result.html).toContain("alipay.trade.page.pay");
      expect(result.html).toContain('name="sign"');
      expect(result.html).toContain("FAST_INSTANT_TRADE_PAY");
      expect(result.mode).toBe("alipay_pc");
    }
  });

  it("builds alipay wap pay form", () => {
    const { privateKey, publicKey } = generateTestKeyPair();
    const result = createAlipayPayment({
      config: {
        enabled: true,
        env: "sandbox",
        appId: "2021000000000000",
        privateKey,
        publicKey,
      },
      mode: "wap",
      orderNo: "ORD202601010002",
      title: "季度会员",
      amount: 69,
      notifyUrl: "https://example.com/api/payment/notify/alipay",
      returnUrl: "https://example.com/payment/result?orderNo=ORD202601010002",
    });

    expect(result.type).toBe("form");
    if (result.type === "form") {
      expect(result.html).toContain("alipay.trade.wap.pay");
      expect(result.html).toContain("QUICK_WAP_WAY");
      expect(result.mode).toBe("alipay_h5");
    }
  });
});

function generateTestKeyPair() {
  const { generateKeyPairSync } = require("crypto") as typeof import("crypto");
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKey: pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}