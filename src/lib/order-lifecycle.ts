import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertOrderTransition,
  assertPaymentTransition,
  pairedStatusesForExpired,
} from "@/lib/payment-state";

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

export async function expireStalePendingOrders(options?: {
  userId?: string;
  now?: Date;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - ORDER_PENDING_TTL_MS);
  const { orderStatus, paymentStatus } = pairedStatusesForExpired();
  let totalExpired = 0;

  while (true) {
    const stale = await prisma.order.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
        ...(options?.userId ? { userId: options.userId } : {}),
      },
      select: { id: true, status: true, payment: { select: { id: true, status: true } } },
      take: STALE_ORDER_BATCH_SIZE,
    });

    if (stale.length === 0) break;

    await prisma.$transaction(async (tx) => {
      for (const order of stale) {
        assertOrderTransition(order.status, orderStatus);
        await tx.order.update({
          where: { id: order.id },
          data: { status: orderStatus },
        });

        if (order.payment) {
          assertPaymentTransition(order.payment.status, paymentStatus);
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: paymentStatus },
          });
        }
      }
    });

    totalExpired += stale.length;
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

  const { orderStatus, paymentStatus } = pairedStatusesForExpired();

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: order.id },
      select: { status: true, payment: { select: { id: true, status: true } } },
    });
    if (!current || current.status !== "PENDING") return;

    assertOrderTransition(current.status, orderStatus);
    await tx.order.update({
      where: { id: order.id },
      data: { status: orderStatus },
    });

    if (current.payment) {
      assertPaymentTransition(current.payment.status, paymentStatus);
      await tx.payment.update({
        where: { id: current.payment.id },
        data: { status: paymentStatus },
      });
    }
  });

  return { expired: true };
}