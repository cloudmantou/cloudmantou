import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentRuntimeConfig: vi.fn(),
  verifyWechatSign: vi.fn(),
  verifyWechatV3Sign: vi.fn(),
  verifyAmount: vi.fn(),
  finalizePaidOrder: vi.fn(),
  grantEntitlement: vi.fn(),
  decryptWechatV3Resource: vi.fn(),
  recordPaymentNotifyAudit: vi.fn(),
  orderFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/payment-config", () => ({
  getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
}));

vi.mock("@/lib/payment", () => ({
  verifyWechatSign: mocks.verifyWechatSign,
  verifyWechatV3Sign: mocks.verifyWechatV3Sign,
  verifyAmount: mocks.verifyAmount,
  finalizePaidOrder: mocks.finalizePaidOrder,
  grantEntitlement: mocks.grantEntitlement,
  decryptWechatV3Resource: mocks.decryptWechatV3Resource,
}));

vi.mock("@/lib/payment-notify-audit", () => ({
  recordPaymentNotifyAudit: mocks.recordPaymentNotifyAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/payment/notify/wechat/route";

const runtimeConfig = {
  siteUrl: "https://example.com",
  testMode: false,
  alipay: null,
  wechat: {
    enabled: true,
    appId: "wx-expected",
    mchId: "mch-expected",
    apiKey: "v2-key",
    apiV3Key: "12345678901234567890123456789012",
    publicKey: "wechat-platform-public-key",
    platformSerial: "platform-serial",
  },
};

function v3Request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/payment/notify/wechat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "wechatpay-timestamp": String(Math.floor(Date.now() / 1000)),
      "wechatpay-nonce": "test-nonce",
      "wechatpay-signature": "test-signature",
      "wechatpay-serial": "platform-serial",
    },
    body: JSON.stringify(body),
  });
}

describe("WeChat payment notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPaymentRuntimeConfig.mockResolvedValue(runtimeConfig);
    mocks.verifyWechatV3Sign.mockReturnValue(true);
    mocks.verifyWechatSign.mockReturnValue(true);
    mocks.verifyAmount.mockReturnValue(true);
    mocks.finalizePaidOrder.mockResolvedValue(true);
    mocks.recordPaymentNotifyAudit.mockResolvedValue(undefined);
  });

  it.each([
    ["appid", { appid: "wx-other", mchid: "mch-expected" }],
    ["mchid", { appid: "wx-expected", mchid: "mch-other" }],
  ])("rejects a signed V3 callback whose %s belongs to another merchant", async (_field, identity) => {
    mocks.decryptWechatV3Resource.mockReturnValue({
      ...identity,
      out_trade_no: "ORDER-001",
      transaction_id: "TX-001",
      trade_state: "SUCCESS",
      amount: { total: 100 },
    });

    const response = await POST(v3Request({ resource: { ciphertext: "encrypted" } }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(600);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({ code: "FAIL" });
    expect(mocks.orderFindUnique).not.toHaveBeenCalled();
  });

  it("accepts a V3 callback only after both merchant identifiers match", async () => {
    mocks.decryptWechatV3Resource.mockReturnValue({
      appid: "wx-expected",
      mchid: "mch-expected",
      out_trade_no: "ORDER-001",
      transaction_id: "TX-001",
      trade_state: "SUCCESS",
      amount: { total: 100 },
    });
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-id",
      status: "PAID",
      payment: { id: "payment-id" },
    });

    const response = await POST(v3Request({ resource: { ciphertext: "encrypted" } }));

    expect(response.status).toBe(204);
    expect(mocks.orderFindUnique).toHaveBeenCalledWith({
      where: { orderNo: "ORDER-001" },
      include: { payment: true },
    });
  });

  it("finalizes a verified PENDING V3 payment through the shared payment service", async () => {
    mocks.decryptWechatV3Resource.mockReturnValue({
      appid: "wx-expected",
      mchid: "mch-expected",
      out_trade_no: "ORDER-PENDING-1",
      transaction_id: "TX-PENDING-1",
      trade_state: "SUCCESS",
      amount: { total: 100 },
    });
    const amount = { toString: () => "1.00" };
    const order = {
      id: "order-pending",
      orderNo: "ORDER-PENDING-1",
      status: "PENDING",
      productType: "VIP_MONTH",
      amount,
      payment: null,
    };
    mocks.orderFindUnique.mockResolvedValue(order);

    const response = await POST(v3Request({ resource: { ciphertext: "encrypted" } }));

    expect(response.status).toBe(204);
    expect(mocks.verifyAmount).toHaveBeenCalledWith(amount, "1.00");
    expect(mocks.finalizePaidOrder).toHaveBeenCalledWith({
      order,
      channel: "WECHAT",
      tradeNo: "TX-PENDING-1",
      rawCallback: expect.any(String),
    });
  });

  it("returns a non-2xx V3 response when the signed body is invalid", async () => {
    const request = new NextRequest("https://example.com/api/payment/notify/wechat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "wechatpay-signature": "test-signature",
      },
      body: "not-json",
    });

    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(600);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("returns a non-2xx V3 response when runtime configuration cannot be loaded", async () => {
    mocks.getPaymentRuntimeConfig.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(v3Request({ resource: { ciphertext: "encrypted" } }));

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({ code: "FAIL" });
  });

  it("keeps the V2 success response compatible", async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-id",
      status: "PAID",
      payment: { id: "payment-id" },
    });
    const xml = [
      "<xml>",
      "<return_code><![CDATA[SUCCESS]]></return_code>",
      "<result_code><![CDATA[SUCCESS]]></result_code>",
      "<appid><![CDATA[wx-expected]]></appid>",
      "<mch_id><![CDATA[mch-expected]]></mch_id>",
      "<out_trade_no><![CDATA[ORDER-001]]></out_trade_no>",
      "<transaction_id><![CDATA[TX-001]]></transaction_id>",
      "<total_fee><![CDATA[100]]></total_fee>",
      "<sign><![CDATA[test-signature]]></sign>",
      "</xml>",
    ].join("");
    const request = new NextRequest("https://example.com/api/payment/notify/wechat", {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body: xml,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    await expect(response.text()).resolves.toContain(
      "<return_code><![CDATA[SUCCESS]]></return_code>"
    );
  });

  it("accepts V2 callbacks that use plain XML text for numeric and identifier fields", async () => {
    const amount = { toString: () => "1.00" };
    const order = {
      id: "order-id",
      status: "PAID",
      amount,
      payment: { id: "payment-id" },
    };
    mocks.orderFindUnique.mockResolvedValue({
      ...order,
    });
    const xml = [
      "<xml>",
      "<return_code>SUCCESS</return_code>",
      "<result_code>SUCCESS</result_code>",
      "<appid>wx-expected</appid>",
      "<mch_id>mch-expected</mch_id>",
      "<out_trade_no>ORDER-PLAIN-001</out_trade_no>",
      "<transaction_id>TX-PLAIN-001</transaction_id>",
      "<total_fee>100</total_fee>",
      "<sign>test-signature</sign>",
      "</xml>",
    ].join("");
    const request = new NextRequest("https://example.com/api/payment/notify/wechat", {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body: xml,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(
      "<return_code><![CDATA[SUCCESS]]></return_code>"
    );
    expect(mocks.orderFindUnique).toHaveBeenCalledWith({
      where: { orderNo: "ORDER-PLAIN-001" },
      include: { payment: true },
    });
    expect(mocks.verifyAmount).toHaveBeenCalledWith(amount, "1.00");
    expect(mocks.finalizePaidOrder).toHaveBeenCalledWith({
      order,
      channel: "WECHAT",
      tradeNo: "TX-PLAIN-001",
      rawCallback: xml,
    });
  });
});
