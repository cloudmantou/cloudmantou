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

  const pooled = await tx.card.findFirst({
    where: {
      packageId: pkg.id,
      status: "ACTIVE",
      orderId: null,
      cardSecretEnc: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!pooled?.cardSecretEnc) {
    throw new Error("该商品卡密库存不足，请先在后台导入或生成卡密");
  }

  const cardId = pooled.id;
  const cardNo = pooled.cardNo;
  const cardSecret = decryptCardSecret(pooled.cardSecretEnc);
  await tx.card.update({
    where: { id: pooled.id },
    data: { orderId: order.id },
  });

  await tx.orderDelivery.create({
    data: {
      orderId: order.id,
      cardId,
      cardNo,
      cardSecretEnc: encryptCardSecret(cardSecret),
      status: "DELIVERED",
    },
  });

  return { cardNo, cardSecret, status: "DELIVERED" };
}

/** 已支付卡密订单若尚未发卡，补发（幂等） */
export async function ensureCardDeliveryForPaidOrder(order: OrderLike & { status: string }) {
  if (order.productType !== "CARD_PACKAGE" || order.status !== "PAID") {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction((tx) => deliverCardPackageOrder(tx, order));
}