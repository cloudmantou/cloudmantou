import type { Prisma } from "@prisma/client";
import {
  encryptCardSecret,
  decryptCardSecret,
} from "@/lib/card-secret-storage";

type Tx = Prisma.TransactionClient;

type OrderLike = {
  id: string;
  userId: string;
  productType: string;
  productId: string | null;
  status?: string;
};

export type DeliveredCard = {
  cardNo: string;
  cardSecret: string;
  status: string;
};

export async function deliverCardPackageOrder(
  tx: Tx,
  order: OrderLike
): Promise<DeliveredCard | null> {
  if (order.productType !== "CARD_PACKAGE" || !order.productId) {
    return null;
  }

  const existing = await tx.orderDelivery.findUnique({
    where: { orderId: order.id },
  });
  if (existing) {
    return {
      cardNo: existing.cardNo,
      cardSecret: decryptCardSecret(existing.cardSecretEnc),
      status: existing.status,
    };
  }

  const pkg = await tx.cardPackage.findUnique({
    where: { id: order.productId },
  });
  if (!pkg) {
    throw new Error("卡密商品不存在");
  }

  const deliveryTime = new Date();
  const availableCardWhere: Prisma.CardWhereInput = {
    packageId: pkg.id,
    status: "ACTIVE",
    orderId: null,
    cardSecretEnc: { not: null },
    OR: [{ expireAt: null }, { expireAt: { gt: deliveryTime } }],
  };
  const availableAtStart = await tx.card.count({ where: availableCardWhere });
  if (availableAtStart === 0) {
    throw new Error("该商品卡密库存不足，请先在后台导入或生成卡密");
  }

  // Repeatable-read transactions may keep seeing a candidate another order
  // already claimed, so exclude each lost candidate from later attempts. The
  // initial inventory count keeps retries bounded without an arbitrary cap.
  let skippedCardIds: string[] = [];
  for (let attempt = 0; attempt < availableAtStart; attempt += 1) {
    const pooled = await tx.card.findFirst({
      where: {
        ...availableCardWhere,
        ...(skippedCardIds.length > 0
          ? { id: { notIn: skippedCardIds } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    if (!pooled?.cardSecretEnc) {
      throw new Error("该商品卡密库存不足，请先在后台导入或生成卡密");
    }

    const claimed = await tx.card.updateMany({
      where: {
        ...availableCardWhere,
        id: pooled.id,
      },
      data: { orderId: order.id },
    });

    if (claimed.count === 0) {
      skippedCardIds = [...skippedCardIds, pooled.id];
      continue;
    }

    const cardSecret = decryptCardSecret(pooled.cardSecretEnc);
    await tx.orderDelivery.create({
      data: {
        orderId: order.id,
        cardId: pooled.id,
        cardNo: pooled.cardNo,
        cardSecretEnc: encryptCardSecret(cardSecret),
        status: "DELIVERED",
      },
    });

    return {
      cardNo: pooled.cardNo,
      cardSecret,
      status: "DELIVERED",
    };
  }

  throw new Error("卡密库存领取冲突，请稍后重试");
}

/** 已支付卡密订单若尚未发卡，补发（幂等） */
export async function ensureCardDeliveryForPaidOrder(order: OrderLike & { status: string }) {
  if (order.productType !== "CARD_PACKAGE" || order.status !== "PAID") {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction((tx) => deliverCardPackageOrder(tx, order));
}

type PaidCardOrder = OrderLike & { status: string };
type CardDeliveryRunner = (
  order: PaidCardOrder
) => Promise<DeliveredCard | null>;

/** Retry a known batch without allowing one broken order to block the rest. */
export async function retryCardDeliveriesForOrders(
  orders: PaidCardOrder[],
  deliver: CardDeliveryRunner = ensureCardDeliveryForPaidOrder
): Promise<{ scanned: number; delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const result = await deliver(order);
      if (result) delivered += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error("[Card Delivery Retry] delivery failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return { scanned: orders.length, delivered, failed };
}

/** Cron/backfill entrypoint for paid card orders with no persisted delivery. */
export async function retryPendingCardDeliveries(limit = 50) {
  const batchSize = Math.max(1, Math.min(100, Math.trunc(limit)));
  const { prisma } = await import("@/lib/prisma");
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      productType: "CARD_PACKAGE",
      delivery: null,
    },
    // Failed rows are touched below and move behind older untouched rows, so a
    // permanently broken first batch cannot starve later deliverable orders.
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
    select: {
      id: true,
      userId: true,
      productType: true,
      productId: true,
      status: true,
    },
  });

  return retryCardDeliveriesForOrders(orders, async (order) => {
    try {
      return await ensureCardDeliveryForPaidOrder(order);
    } catch (error) {
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { updatedAt: new Date() },
        });
      } catch (touchError) {
        console.error("[Card Delivery Retry] failed to rotate pending order", {
          orderId: order.id,
          error: touchError instanceof Error ? touchError.message : "unknown",
        });
      }
      throw error;
    }
  });
}
