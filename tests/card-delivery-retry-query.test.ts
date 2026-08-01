import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindMany,
      update: mocks.orderUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { retryPendingCardDeliveries } from "@/lib/card-delivery";

describe("pending card delivery query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([
      {
        id: "order-failed",
        userId: "user-1",
        productType: "CARD_PACKAGE",
        productId: "package-1",
        status: "PAID",
      },
      {
        id: "order-ok",
        userId: "user-2",
        productType: "CARD_PACKAGE",
        productId: "package-2",
        status: "PAID",
      },
    ]);
    mocks.orderUpdate.mockResolvedValue({});
    mocks.transaction
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        cardNo: "NO-OK",
        cardSecret: "SECRET",
        status: "DELIVERED",
      });
  });

  it("selects persisted pending rows and rotates a failed row behind untouched work", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(retryPendingCardDeliveries()).resolves.toEqual({
      scanned: 2,
      delivered: 1,
      failed: 1,
    });
    expect(mocks.orderFindMany).toHaveBeenCalledWith({
      where: {
        status: "PAID",
        productType: "CARD_PACKAGE",
        delivery: null,
      },
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
      take: 50,
      select: {
        id: true,
        userId: true,
        productType: true,
        productId: true,
        status: true,
      },
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-failed" },
      data: { updatedAt: expect.any(Date) },
    });
    consoleError.mockRestore();
  });
});
