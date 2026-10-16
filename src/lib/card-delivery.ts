import type { Prisma } from "@prisma/client";
import { POINT_CARD_PREFIX, encryptPointCardSecret } from "@/lib/point-card-crypto";
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
  const reserved = await tx.card.findUnique({ where: { orderId: order.id } });
  const card = reserved && isDeliverableCard(reserved, pkg.id, deliveryTime)
    ? reserved
    : await (async () => {
        // 预占卡已被后台禁用/删除或过期：先释放旧占用（orderId 唯一），再从库存池补领。
        if (reserved) {
          await tx.card.updateMany({
            where: { id: reserved.id, orderId: order.id },
            data: { orderId: null },
          });
        }
        return claimPooledCard(tx, pkg.id, order.id, deliveryTime);
      })();

  const cardSecret = decryptCardSecret(card.cardSecretEnc!);
  await tx.orderDelivery.create({
    data: {
      orderId: order.id,
      cardId: card.id,
      cardNo: card.cardNo,
      cardSecretEnc: card.cardSecretEnc!.startsWith(POINT_CARD_PREFIX) ? encryptPointCardSecret(cardSecret) : encryptCardSecret(cardSecret),
      status: "DELIVERED",
    },
  });

  return {
    cardNo: card.cardNo,
    cardSecret,
    status: "DELIVERED",
  };
}

type ClaimableCard = {
  id: string;
  cardNo: string;
  cardSecretEnc: string | null;
  packageId: string | null;
  status: string;
  expireAt?: Date | null;
};

function deliverableCardWhere(packageId: string, now: Date): Prisma.CardWhereInput {
  return {
    packageId,
    status: "ACTIVE",
    orderId: null,
    cardSecretEnc: { not: null },
    OR: [{ expireAt: null }, { expireAt: { gt: now } }],
  };
}

function isDeliverableCard(card: ClaimableCard, packageId: string, now: Date): boolean {
  return (
    card.packageId === packageId &&
    card.status === "ACTIVE" &&
    Boolean(card.cardSecretEnc) &&
    (!card.expireAt || card.expireAt > now)
  );
}

/** 从库存池原子领取一张卡并写入 orderId；库存不足时抛错。 */
async function claimPooledCard(
  tx: Tx,
  packageId: string,
  orderId: string,
  now: Date
): Promise<ClaimableCard & { cardSecretEnc: string }> {
  const availableCardWhere = deliverableCardWhere(packageId, now);
  const availableAtStart = await tx.card.count({ where: availableCardWhere });
  if (availableAtStart === 0) {
    throw new CardStockError();
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
      throw new CardStockError();
    }

    const claimed = await tx.card.updateMany({
      where: {
        ...availableCardWhere,
        id: pooled.id,
      },
      data: { orderId },
    });

    if (claimed.count === 1) {
      return { ...pooled, cardSecretEnc: pooled.cardSecretEnc };
    }
    skippedCardIds = [...skippedCardIds, pooled.id];
  }

  throw new Error("卡密库存领取冲突，请稍后重试");
}

export class CardStockError extends Error {
  constructor() {
    super("该商品卡密库存不足，请先在后台导入或生成卡密");
    this.name = "CardStockError";
  }
}

/**
 * 下单时为卡密订单预占一张卡（写入 Card.orderId），防止并发支付超卖。
 * 预占卡不计入可售库存；订单过期时由 releaseCardReservations 归还。
 */
export async function reserveCardForOrder(
  tx: Tx,
  order: { id: string; productId: string },
  now = new Date()
): Promise<void> {
  await claimPooledCard(tx, order.productId, order.id, now);
}

/** 归还未支付订单预占的卡（仅在订单进入 EXPIRED/CANCELLED 时调用）。 */
export async function releaseCardReservations(tx: Tx, orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  const released = await tx.card.updateMany({
    where: { orderId: { in: orderIds }, delivery: { is: null } },
    data: { orderId: null },
  });
  return released.count;
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
