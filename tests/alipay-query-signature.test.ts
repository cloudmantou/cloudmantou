import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryAlipayTrade } from "@/lib/payment-providers";

const keys = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const config = {
  enabled: true,
  env: "sandbox" as const,
  appId: "test-app",
  privateKey: keys.privateKey,
  publicKey: keys.publicKey,
};

function signedResponse(response: Record<string, string>): string {
  const signContent = JSON.stringify(response);
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signContent, "utf8"), keys.privateKey);
  return `{"alipay_trade_query_response":${signContent},"sign":"${signature.toString("base64")}"}`;
}

describe("Alipay active-query response signature", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts the exact signed response node and rejects post-signature tampering", async () => {
    const valid = signedResponse({
      code: "10000",
      trade_status: "TRADE_SUCCESS",
      out_trade_no: "ORDER-1",
      trade_no: "2026080500000001",
      total_amount: "1.00",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ text: async () => valid })
      .mockResolvedValueOnce({ text: async () => valid.replace('"1.00"', '"9.00"') });
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryAlipayTrade({ config, orderNo: "ORDER-1" })).resolves.toMatchObject({
      paid: true,
      tradeNo: "2026080500000001",
      totalAmount: "1.00",
    });
    await expect(queryAlipayTrade({ config, orderNo: "ORDER-1" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应签名无效",
    });
  });

  it("rejects duplicate response nodes instead of verifying one and consuming another", async () => {
    const first = {
      code: "10000",
      trade_status: "TRADE_SUCCESS",
      out_trade_no: "ORDER-1",
      trade_no: "2026080500000001",
      total_amount: "1.00",
    };
    const firstContent = JSON.stringify(first);
    const signature = crypto.sign("RSA-SHA256", Buffer.from(firstContent, "utf8"), keys.privateKey);
    const raw = `{"alipay_trade_query_response":${firstContent},` +
      `"alipay_trade_query_response":${JSON.stringify({ ...first, total_amount: "99.00" })},` +
      `"sign":"${signature.toString("base64")}"}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: async () => raw }));

    await expect(queryAlipayTrade({ config, orderNo: "ORDER-1" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应节点缺失或重复",
    });
  });
});
