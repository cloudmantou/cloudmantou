import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getPaymentRuntimeConfig: vi.fn(),
  createAlipayPayment: vi.fn(),
  expireStalePendingOrders: vi.fn(),
  ensureOrderPayable: vi.fn(),
  claimPaymentChannel: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.findUnique },
    payment: { upsert: mocks.upsert },
  },
}));
vi.mock("@/lib/payment-config", () => ({
  getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
}));
vi.mock("@/lib/payment-providers", () => ({
  createAlipayPayment: mocks.createAlipayPayment,
}));
vi.mock("@/lib/order-lifecycle", () => ({
  expireStalePendingOrders: mocks.expireStalePendingOrders,
  ensureOrderPayable: mocks.ensureOrderPayable,
}));
vi.mock("@/lib/payment-channel", () => ({
  claimPaymentChannel: mocks.claimPaymentChannel,
}));

import { GET } from "@/app/payment/alipay-launch/route";

describe("Alipay launch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findUnique.mockResolvedValue({
      id: "order-1",
      orderNo: "ORD-1",
      userId: "user-1",
      title: "Card package",
      amount: { toString: () => "1.00" },
      status: "PENDING",
      createdAt: new Date(),
      payment: null,
    });
    mocks.upsert.mockResolvedValue({});
    mocks.getPaymentRuntimeConfig.mockResolvedValue({
      siteUrl: "https://example.test",
      alipay: { enabled: true },
    });
    mocks.createAlipayPayment.mockImplementation((input: { scriptNonce: string }) => ({
      type: "form",
      mode: "alipay_pc",
      html: `<script nonce="${input.scriptNonce}"></script>`,
    }));
    mocks.ensureOrderPayable.mockResolvedValue({ expired: false });
    mocks.claimPaymentChannel.mockResolvedValue(true);
  });

  it("uses the middleware nonce in both CSP and the launch script", async () => {
    const response = await GET(new NextRequest(
      "https://example.test/payment/alipay-launch?orderId=order-1&scene=pc",
      { headers: { "x-nonce": "middleware-nonce-123" } }
    ));
    const html = await response.text();
    const csp = response.headers.get("content-security-policy") || "";

    expect(response.status).toBe(200);
    expect(mocks.createAlipayPayment).toHaveBeenCalledWith(
      expect.objectContaining({ scriptNonce: "middleware-nonce-123" })
    );
    expect(html).toContain('nonce="middleware-nonce-123"');
    expect(csp).toContain("'nonce-middleware-nonce-123'");
    expect(csp).not.toContain("unsafe-inline");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.claimPaymentChannel).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "order-1",
      channel: "ALIPAY",
    }));
  });

  it("does not overwrite an order already bound to WeChat", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "order-1",
      orderNo: "ORD-1",
      userId: "user-1",
      title: "Card package",
      amount: { toString: () => "1.00" },
      status: "PENDING",
      createdAt: new Date(),
      payment: { channel: "WECHAT", status: "WAITING" },
    });

    const response = await GET(new NextRequest(
      "https://example.test/payment/alipay-launch?orderId=order-1&scene=pc",
      { headers: { "x-nonce": "middleware-nonce-123" } }
    ));

    expect(response.status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.createAlipayPayment).not.toHaveBeenCalled();
  });

  it("does not launch a stale pending order", async () => {
    mocks.ensureOrderPayable.mockResolvedValue({ expired: true });

    const response = await GET(new NextRequest(
      "https://example.test/payment/alipay-launch?orderId=order-1&scene=pc",
      { headers: { "x-nonce": "middleware-nonce-123" } }
    ));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("过期");
    expect(mocks.claimPaymentChannel).not.toHaveBeenCalled();
    expect(mocks.createAlipayPayment).not.toHaveBeenCalled();
  });
});
