import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPaymentRuntimeConfig: vi.fn(),
  orderFindUnique: vi.fn(),
  finalizePaidOrder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/payment-config", () => ({
  getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: mocks.orderFindUnique } },
}));
vi.mock("@/lib/payment", () => ({ finalizePaidOrder: mocks.finalizePaidOrder }));

import { POST } from "@/app/api/payment/test-pay/route";

describe("test payment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getPaymentRuntimeConfig.mockResolvedValue({ testMode: true });
  });

  it("rejects cancelled orders instead of reporting a false paid result", async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-1",
      orderNo: "ORDER-1",
      userId: "user-1",
      status: "CANCELLED",
      payment: null,
    });

    const response = await POST(new NextRequest("https://example.com/api/payment/test-pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "order-1" }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.finalizePaidOrder).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: 40900 });
  });
});
