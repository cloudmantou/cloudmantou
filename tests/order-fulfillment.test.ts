import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/card-secret-storage", () => ({
  decryptCardSecret: vi.fn((value: string) => `plain:${value}`),
}));

import { buildOrderFulfillment } from "@/lib/order-fulfillment";

describe("buildOrderFulfillment", () => {
  it("keeps unpaid orders free of fulfillment details", () => {
    expect(buildOrderFulfillment({
      status: "PENDING",
      productType: "CARD_PACKAGE",
      delivery: { cardNo: "CARD-1", cardSecretEnc: "secret" },
    })).toEqual({ kind: "none", message: null, card: null });
  });

  it("returns an owner-facing card receipt after delivery", () => {
    expect(buildOrderFulfillment({
      status: "PAID",
      productType: "CARD_PACKAGE",
      delivery: { cardNo: "CARD-1", cardSecretEnc: "secret" },
    })).toEqual({
      kind: "card",
      message: "卡密已发放，请妥善保存",
      card: { cardNo: "CARD-1", cardSecret: "plain:secret" },
    });
  });

  it("represents pending card, membership, article, and unknown fulfillment", () => {
    expect(buildOrderFulfillment({
      status: "PAID", productType: "CARD_PACKAGE", delivery: null,
    })).toMatchObject({ kind: "card", card: null });
    expect(buildOrderFulfillment({
      status: "PAID", productType: "VIP_YEAR", delivery: null,
    })).toMatchObject({ kind: "membership", card: null });
    expect(buildOrderFulfillment({
      status: "PAID", productType: "PAID_POST", delivery: null,
    })).toMatchObject({ kind: "article", card: null });
    expect(buildOrderFulfillment({
      status: "PAID", productType: "UNKNOWN", delivery: null,
    })).toEqual({ kind: "none", message: null, card: null });
  });
});
