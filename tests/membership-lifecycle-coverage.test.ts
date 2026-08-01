import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  paymentUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const transactionClient = {
    order: {
      findUnique: mocks.orderFindUnique,
      update: mocks.orderUpdate,
    },
    payment: { update: mocks.paymentUpdate },
  };

  return {
    prisma: {
      order: { findMany: mocks.orderFindMany },
      $transaction: mocks.transaction,
    },
    __transactionClient: transactionClient,
  };
});

import {
  assertOrderPayable,
  ensureOrderPayable,
  expireStalePendingOrders,
  isOrderExpiredByAge,
  ORDER_PENDING_TTL_MS,
} from "@/lib/order-lifecycle";

const NOW = new Date("2026-07-19T12:00:00.000Z");
const FRESH = new Date(NOW.getTime() - ORDER_PENDING_TTL_MS);
const STALE = new Date(NOW.getTime() - ORDER_PENDING_TTL_MS - 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetAllMocks();

  const tx = {
    order: {
      findUnique: mocks.orderFindUnique,
      update: mocks.orderUpdate,
    },
    payment: { update: mocks.paymentUpdate },
  };
  mocks.transaction.mockImplementation(
    async (callback: (client: typeof tx) => unknown) => callback(tx)
  );
  mocks.orderUpdate.mockResolvedValue({});
  mocks.paymentUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("order age and payable guards", () => {
  it("expires only after the complete pending TTL has elapsed", () => {
    expect(isOrderExpiredByAge(FRESH, NOW)).toBe(false);
    expect(isOrderExpiredByAge(STALE, NOW)).toBe(true);
    expect(isOrderExpiredByAge(STALE)).toBe(true);
  });

  it("accepts a fresh pending order", () => {
    expect(() => assertOrderPayable("PENDING", FRESH, NOW)).not.toThrow();
  });

  it("classifies explicit and age-based expiry before other non-payable states", () => {
    expect(() => assertOrderPayable("EXPIRED", FRESH, NOW)).toThrow("ORDER_EXPIRED");
    expect(() => assertOrderPayable("PENDING", STALE, NOW)).toThrow("ORDER_EXPIRED");
    expect(() => assertOrderPayable("PAID", FRESH, NOW)).toThrow("ORDER_NOT_PAYABLE");
    expect(() => assertOrderPayable("CANCELLED", FRESH, NOW)).toThrow("ORDER_NOT_PAYABLE");
  });
});

describe("batch expiry", () => {
  it("returns zero without opening a transaction when no stale order exists", async () => {
    mocks.orderFindMany.mockResolvedValue([]);

    await expect(expireStalePendingOrders({ now: NOW })).resolves.toBe(0);
    expect(mocks.orderFindMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(NOW.getTime() - ORDER_PENDING_TTL_MS) },
      },
      select: {
        id: true,
        status: true,
        payment: { select: { id: true, status: true } },
      },
      take: 100,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("uses the current clock when batch expiry options are omitted", async () => {
    mocks.orderFindMany.mockResolvedValue([]);

    await expect(expireStalePendingOrders()).resolves.toBe(0);
    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(NOW.getTime() - ORDER_PENDING_TTL_MS) },
        }),
      })
    );
  });

  it("expires multiple batches, closes attached payments, and scopes by user", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => ({
      id: `order-${index}`,
      status: "PENDING",
      payment: index % 2 === 0
        ? { id: `payment-${index}`, status: "WAITING" }
        : null,
    }));
    const lastOrder = {
      id: "order-100",
      status: "PENDING",
      payment: { id: "payment-100", status: "WAITING" },
    };
    mocks.orderFindMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([lastOrder]);

    await expect(
      expireStalePendingOrders({ userId: "user-1", now: NOW })
    ).resolves.toBe(101);

    expect(mocks.orderFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.orderFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
        take: 100,
      })
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.orderUpdate).toHaveBeenCalledTimes(101);
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-100" },
      data: { status: "EXPIRED" },
    });
    expect(mocks.paymentUpdate).toHaveBeenCalledTimes(51);
    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "payment-100" },
      data: { status: "CLOSED" },
    });
  });
});

describe("single-order payable reconciliation", () => {
  it("returns existing terminal state without a transaction", async () => {
    await expect(
      ensureOrderPayable({ id: "expired", status: "EXPIRED", createdAt: STALE })
    ).resolves.toEqual({ expired: true });
    await expect(
      ensureOrderPayable({ id: "paid", status: "PAID", createdAt: STALE })
    ).resolves.toEqual({ expired: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("leaves a fresh pending order untouched", async () => {
    await expect(
      ensureOrderPayable({ id: "fresh", status: "PENDING", createdAt: FRESH })
    ).resolves.toEqual({ expired: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("handles an order that disappeared or changed status during reconciliation", async () => {
    mocks.orderFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      status: "PAID",
      payment: { id: "payment-1", status: "SUCCESS" },
    });

    await expect(
      ensureOrderPayable({ id: "missing", status: "PENDING", createdAt: STALE })
    ).resolves.toEqual({ expired: true });
    await expect(
      ensureOrderPayable({ id: "raced", status: "PENDING", createdAt: STALE })
    ).resolves.toEqual({ expired: true });
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.paymentUpdate).not.toHaveBeenCalled();
  });

  it("atomically expires a stale pending order without a payment", async () => {
    mocks.orderFindUnique.mockResolvedValue({ status: "PENDING", payment: null });

    await expect(
      ensureOrderPayable({ id: "order-1", status: "PENDING", createdAt: STALE })
    ).resolves.toEqual({ expired: true });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "EXPIRED" },
    });
    expect(mocks.paymentUpdate).not.toHaveBeenCalled();
  });

  it("atomically expires a stale order and closes its waiting payment", async () => {
    mocks.orderFindUnique.mockResolvedValue({
      status: "PENDING",
      payment: { id: "payment-1", status: "WAITING" },
    });

    await expect(
      ensureOrderPayable({ id: "order-1", status: "PENDING", createdAt: STALE })
    ).resolves.toEqual({ expired: true });
    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: "CLOSED" },
    });
  });
});
