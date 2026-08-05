import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  getPaymentRuntimeConfig: vi.fn(),
  queryAlipayTrade: vi.fn(),
  queryWechatTrade: vi.fn(),
  expireStalePendingOrders: vi.fn(),
  ensureOrderPayable: vi.fn(),
  finalizePaidOrder: vi.fn(),
  finalizeAlipayOrder: vi.fn(),
  verifyAmount: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/payment-config", () => ({
  getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
}));
vi.mock("@/lib/payment-providers", () => ({
  queryAlipayTrade: mocks.queryAlipayTrade,
  queryWechatTrade: mocks.queryWechatTrade,
}));
vi.mock("@/lib/order-lifecycle", () => ({
  expireStalePendingOrders: mocks.expireStalePendingOrders,
  ensureOrderPayable: mocks.ensureOrderPayable,
}));
vi.mock("@/lib/payment", () => ({
  finalizePaidOrder: mocks.finalizePaidOrder,
  finalizeAlipayOrder: mocks.finalizeAlipayOrder,
  isValidAlipayTradeNo: vi.fn(() => true),
  isValidWechatTradeNo: vi.fn(() => true),
  verifyAlipaySign: vi.fn(() => false),
  verifyAmount: mocks.verifyAmount,
}));
vi.mock("@/lib/rate-limit-server", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from "@/app/api/payment/sync/route";

describe("payment sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.ensureOrderPayable.mockResolvedValue({ expired: false });
    mocks.verifyAmount.mockReturnValue(true);
    mocks.finalizePaidOrder.mockResolvedValue(true);
    mocks.finalizeAlipayOrder.mockResolvedValue(true);
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.getPaymentRuntimeConfig.mockResolvedValue({
      alipay: { enabled: true },
      wechat: { enabled: true },
    });
  });

  it("uses WeChat order query for a WeChat QR payment", async () => {
    const order = {
      id: "order-1",
      orderNo: "ORD-WX-1",
      userId: "user-1",
      status: "PENDING",
      productType: "CARD_PACKAGE",
      productId: "package-1",
      amount: { toString: () => "12.35" },
      payment: { channel: "WECHAT", status: "WAITING" },
    };
    mocks.findUnique.mockResolvedValue(order);
    mocks.queryWechatTrade.mockResolvedValue({
      paid: true,
      transactionId: "4200000000202608050000000001",
      totalFee: 1235,
      tradeState: "SUCCESS",
      raw: "<xml />",
    });

    const response = await POST(new NextRequest("https://example.test/api/payment/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo: "ORD-WX-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ status: "PAID", source: "wechat_query" });
    expect(mocks.queryWechatTrade).toHaveBeenCalledWith(expect.objectContaining({ orderNo: "ORD-WX-1" }));
    expect(mocks.queryAlipayTrade).not.toHaveBeenCalled();
    expect(mocks.finalizePaidOrder).toHaveBeenCalledWith(expect.objectContaining({
      order,
      channel: "WECHAT",
      tradeNo: "4200000000202608050000000001",
    }));
  });

  it("returns the authoritative order status when finalization loses a race", async () => {
    const pendingOrder = {
      id: "order-1",
      orderNo: "ORD-WX-1",
      userId: "user-1",
      status: "PENDING",
      productType: "CARD_PACKAGE",
      productId: "package-1",
      amount: { toString: () => "12.35" },
      payment: { channel: "WECHAT", status: "WAITING" },
    };
    mocks.findUnique
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ status: "EXPIRED" });
    mocks.queryWechatTrade.mockResolvedValue({
      paid: true,
      transactionId: "4200000000202608050000000001",
      totalFee: 1235,
      tradeState: "SUCCESS",
      raw: "<xml />",
    });
    mocks.finalizePaidOrder.mockResolvedValue(false);

    const response = await POST(new NextRequest("https://example.test/api/payment/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo: "ORD-WX-1" }),
    }));
    const body = await response.json();

    expect(body.data).toMatchObject({ status: "EXPIRED", synced: false, source: "authoritative" });
  });

  it("throttles repeated provider synchronization for the same user and order", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "order-1",
      orderNo: "ORD-WX-1",
      userId: "user-1",
      status: "PENDING",
    });
    mocks.checkRateLimit
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response("limited", { status: 429 }));

    const response = await POST(new NextRequest("https://example.test/api/payment/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo: "ORD-WX-1" }),
    }));

    expect(response.status).toBe(429);
    expect(mocks.queryWechatTrade).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      1,
      expect.any(NextRequest),
      expect.objectContaining({ scope: "payment-sync" }),
      "user-1"
    );
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(NextRequest),
      expect.objectContaining({ scope: "payment-sync:ORD-WX-1" }),
      "user-1"
    );
  });
});
