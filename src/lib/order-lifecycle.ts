import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertOrderTransition,
  assertPaymentTransition,
  pairedStatusesForExpired,
} from "@/lib/payment-state";
import { releaseCardReservations } from "@/lib/card-delivery";

/** 待支付订单默认 30 分钟过期 */
export const ORDER_PENDING_TTL_MS = 30 * 60 * 1000;

export function isOrderExpiredByAge(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > ORDER_PENDING_TTL_MS;
}

export function assertOrderPayable(status: OrderStatus, createdAt: Date, now = new Date()): void {
  if (status === "EXPIRED" || (status === "PENDING" && isOrderExpiredByAge(createdAt, now))) {
    throw new Error("ORDER_EXPIRED");
  }
  if (status !== "PENDING") {
    throw new Error("ORDER_NOT_PAYABLE");
  }
}

/**
 * 将超时 PENDING 订单标记为 EXPIRED，并关闭关联支付单。
 */
const STALE_ORDER_BATCH_SIZE = 100;

type ExpirableOrder = {
  id: string;
  status: OrderStatus;
  payment: { id: string; status: PaymentStatus } | null;
};

/**
 * 条件更新 PENDING → EXPIRED：读取快照之后可能已有支付回调把订单改为 PAID，
 * 因此以数据库当前状态为准，未发生转换时不关闭支付单、不归还预占卡。
 */
async function expirePendingOrderInTx(
  tx: Prisma.TransactionClient,
  order: ExpirableOrder
): Promise<boolean> {
  const { orderStatus, paymentStatus } = pairedStatusesForExpired();
  assertOrderTransition(order.status, orderStatus);
  const updated = await tx.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: orderStatus },
  });
  if (updated.count !== 1) return false;

  if (order.payment) {
    assertPaymentTransition(order.payment.status, paymentStatus);
    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: paymentStatus },
    });
  }
  return true;
}

export async function expireStalePendingOrders(options?: {
  userId?: string;
  /** 仅处理某个卡密套餐的订单，用于下单前及时归还超时预占的库存 */
  cardPackageId?: string;
  now?: Date;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - ORDER_PENDING_TTL_MS);
  let totalExpired = 0;

  while (true) {
    const stale = await prisma.order.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
        ...(options?.userId ? { userId: options.userId } : {}),
        ...(options?.cardPackageId
          ? { productType: "CARD_PACKAGE" as const, productId: options.cardPackageId }
          : {}),
      },
      select: { id: true, status: true, payment: { select: { id: true, status: true } } },
      take: STALE_ORDER_BATCH_SIZE,
    });

    if (stale.length === 0) break;

    const expiredIds = await prisma.$transaction(async (tx) => {
      const transitioned: string[] = [];
      for (const order of stale) {
        if (await expirePendingOrderInTx(tx, order)) transitioned.push(order.id);
      }
      // 只归还真正由本事务置为 EXPIRED 的订单；并发已支付的订单保留预占卡用于发卡。
      await releaseCardReservations(tx, transitioned);
      return transitioned;
    });

    totalExpired += expiredIds.length;
    if (stale.length < STALE_ORDER_BATCH_SIZE) break;
  }

  return totalExpired;
}

/**
 * 单笔订单过期检查（支付前调用）。
 */
export async function ensureOrderPayable(order: {
  id: string;
  status: OrderStatus;
  createdAt: Date;
}): Promise<{ expired: boolean }> {
  if (order.status !== "PENDING") {
    return { expired: order.status === "EXPIRED" };
  }

  if (!isOrderExpiredByAge(order.createdAt)) {
    return { expired: false };
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: order.id },
      select: { status: true, payment: { select: { id: true, status: true } } },
    });
    if (!current || current.status !== "PENDING") return;
    if (await expirePendingOrderInTx(tx, { ...current, id: order.id })) {
      await releaseCardReservations(tx, [order.id]);
    }
  });

  return { expired: true };
}