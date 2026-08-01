import { beforeAll, describe, expect, it, vi } from "vitest";

type FinalizePaidOrderInTransaction = typeof import("@/lib/payment")["finalizePaidOrderInTransaction"];

let finalizePaidOrderInTransaction: FinalizePaidOrderInTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL ||= "mysql://fake:fake@localhost:3306/fake";
  ({ finalizePaidOrderInTransaction } = await import("@/lib/payment"));
});

function createTransactionMock(options?: {
  currentOrderStatus?: string;
  currentPaymentStatus?: string | null;
  updateCount?: number;
}) {
  const currentOrderStatus = options?.currentOrderStatus ?? "PENDING";
  const currentPaymentStatus = options?.currentPaymentStatus ?? null;
  const updateCount = options?.updateCount ?? 1;

  const tx = {
    order: {
      findUnique: vi.fn(async () => ({
        status: currentOrderStatus,
        payment: currentPaymentStatus
          ? { id: "payment-1", status: currentPaymentStatus }
          : null,
      })),
      updateMany: vi.fn(async () => ({ count: updateCount })),
    },
    payment: {
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
  };

  return tx;
}

const order = {
  id: "order-1",
  userId: "user-1",
  productType: "UNKNOWN",
  productId: null,
  status: "PENDING",
  amount: { toString: () => "9.90" },
  payment: null,
};

describe("finalizePaidOrderInTransaction", () => {
  it("persists a normalized WeChat payment before granting the order", async () => {
    const tx = createTransactionMock();
    const grantOrder = vi.fn(async () => undefined);

    const finalized = await finalizePaidOrderInTransaction(tx as never, {
      order: order as never,
      channel: "WECHAT",
      tradeNo: "wx-trade-1",
      rawCallback: "{\"event_type\":\"TRANSACTION.SUCCESS\"}",
      grantOrder,
    });

    expect(finalized).toBe(true);
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        channel: "WECHAT",
        tradeNo: "wx-trade-1",
        status: "SUCCESS",
      }),
    });
    expect(grantOrder).toHaveBeenCalledOnce();
  });

  it("does not grant twice when another callback already finalized the order", async () => {
    const tx = createTransactionMock({ updateCount: 0 });
    const grantOrder = vi.fn(async () => undefined);

    const finalized = await finalizePaidOrderInTransaction(tx as never, {
      order: order as never,
      channel: "ALIPAY",
      tradeNo: "2026071900000001",
      rawCallback: "trade_status=TRADE_SUCCESS",
      grantOrder,
    });

    expect(finalized).toBe(false);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(grantOrder).not.toHaveBeenCalled();
  });

  it("treats a concurrently paid order as an idempotent success without granting twice", async () => {
    const tx = createTransactionMock({ currentOrderStatus: "PAID" });
    const grantOrder = vi.fn(async () => undefined);

    const finalized = await finalizePaidOrderInTransaction(tx as never, {
      order: order as never,
      channel: "WECHAT",
      tradeNo: "wx-duplicate",
      rawCallback: "{}",
      grantOrder,
    });

    expect(finalized).toBe(true);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(grantOrder).not.toHaveBeenCalled();
  });

  it("updates an existing pending payment through the same provider-neutral path", async () => {
    const tx = createTransactionMock({ currentPaymentStatus: "WAITING" });
    const grantOrder = vi.fn(async () => undefined);

    const finalized = await finalizePaidOrderInTransaction(tx as never, {
      order: { ...order, payment: { id: "payment-1" } } as never,
      channel: "ALIPAY",
      tradeNo: "2026071900000002",
      rawCallback: "trade_status=TRADE_SUCCESS",
      grantOrder,
    });

    expect(finalized).toBe(true);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: expect.objectContaining({ channel: "ALIPAY", status: "SUCCESS" }),
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("commits paid card-package orders without coupling the payment transaction to stock", async () => {
    const tx = createTransactionMock();

    const finalized = await finalizePaidOrderInTransaction(tx as never, {
      order: {
        ...order,
        productType: "CARD_PACKAGE",
        productId: "package-1",
      } as never,
      channel: "WECHAT",
      tradeNo: "wx-card-order",
      rawCallback: "{}",
    });

    expect(finalized).toBe(true);
    expect(tx.order.updateMany).toHaveBeenCalledOnce();
    expect(tx.payment.create).toHaveBeenCalledOnce();
  });
});
