import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  orderFindUnique: vi.fn(),
  cardPackageFindUnique: vi.fn(),
  ensureCardDeliveryForPaidOrder: vi.fn(),
  decryptCardSecret: vi.fn(() => "delivered-secret"),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUnique },
    cardPackage: { findUnique: mocks.cardPackageFindUnique },
  },
}));
vi.mock("@/lib/card-delivery", () => ({
  ensureCardDeliveryForPaidOrder: mocks.ensureCardDeliveryForPaidOrder,
}));
vi.mock("@/lib/card-secret-storage", () => ({
  decryptCardSecret: mocks.decryptCardSecret,
}));

import { GET } from "@/app/api/payment/status/route";

function paidCardOrder(userId = "user-1") {
  return {
    id: "order-1",
    orderNo: "ORD-1",
    userId,
    status: "PAID",
    title: "Card package",
    amount: { toString: () => "1.00", valueOf: () => 1 },
    productType: "CARD_PACKAGE",
    productId: "package-1",
    paidAt: new Date("2026-08-05T00:00:00Z"),
    payment: { channel: "WECHAT", status: "SUCCESS" },
    delivery: {
      cardNo: "CARD-001",
      cardSecretEnc: "encrypted-secret",
      status: "DELIVERED",
    },
  };
}

describe("payment status receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.cardPackageFindUnique.mockResolvedValue({
      slug: "vip-30",
      cardType: "VIP",
      cardValue: 30,
    });
  });

  it("returns the owned paid card fulfillment for the success receipt", async () => {
    mocks.orderFindUnique.mockResolvedValue(paidCardOrder());
    const response = await GET(new NextRequest(
      "https://example.test/api/payment/status?orderNo=ORD-1"
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.fulfillment).toEqual({
      kind: "card",
      message: "卡密已发放，请妥善保存",
      card: { cardNo: "CARD-001", cardSecret: "delivered-secret" },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not disclose another user's fulfillment", async () => {
    mocks.orderFindUnique.mockResolvedValue(paidCardOrder("other-user"));
    const response = await GET(new NextRequest(
      "https://example.test/api/payment/status?orderNo=ORD-1"
    ));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.data).toBeNull();
    expect(mocks.decryptCardSecret).not.toHaveBeenCalled();
  });
});
