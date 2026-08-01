import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentRuntimeConfig: vi.fn(),
  orderFindUnique: vi.fn(),
  verifyAlipaySign: vi.fn(),
  verifyAmount: vi.fn(),
  finalizeAlipayOrder: vi.fn(),
  recordPaymentNotifyAudit: vi.fn(),
}));

vi.mock("@/lib/payment-config", () => ({
  getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: mocks.orderFindUnique } },
}));
vi.mock("@/lib/payment", () => ({
  isValidAlipayTradeNo: (value: string) => /^[0-9A-Za-z]{16,28}$/.test(value),
  verifyAlipaySign: mocks.verifyAlipaySign,
  verifyAmount: mocks.verifyAmount,
  finalizeAlipayOrder: mocks.finalizeAlipayOrder,
}));
vi.mock("@/lib/payment-notify-audit", () => ({
  recordPaymentNotifyAudit: mocks.recordPaymentNotifyAudit,
}));

import { POST } from "@/app/api/payment/notify/alipay/route";

function request(): NextRequest {
  return new NextRequest("https://example.com/api/payment/notify/alipay", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      app_id: "app-expected",
      seller_id: "seller-expected",
      out_trade_no: "ORDER-PAID-1",
      trade_no: "2026071900000001",
      trade_status: "TRADE_SUCCESS",
      total_amount: "1.00",
      sign: "invalid-signature",
    }).toString(),
  });
}

describe("Alipay notification idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPaymentRuntimeConfig.mockResolvedValue({
      alipay: {
        publicKey: "public-key",
        appId: "app-expected",
        sellerId: "seller-expected",
      },
    });
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-id",
      status: "PAID",
      amount: { toString: () => "1.00" },
      payment: { id: "payment-id" },
    });
    mocks.verifyAmount.mockReturnValue(true);
    mocks.recordPaymentNotifyAudit.mockResolvedValue(undefined);
  });

  it("does not acknowledge a duplicate paid notification before signature verification", async () => {
    mocks.verifyAlipaySign.mockReturnValue(false);

    const response = await POST(request());

    expect(await response.text()).toBe("failure");
    expect(mocks.verifyAlipaySign).toHaveBeenCalledOnce();
    expect(mocks.finalizeAlipayOrder).not.toHaveBeenCalled();
  });
});
