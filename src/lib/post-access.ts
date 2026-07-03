import { prisma } from "@/lib/prisma";

export type PostAccessResult = {
  hasAccess: boolean;
  reason: "published" | "vip_active" | "paid_post_entitled" | "article_credit" | "no_access";
  content: string | null;
};

async function consumeArticleCredit(userId: string, postId: string, now: Date) {
  const credit = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "PAID_POST",
      postId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!credit) return false;

  await prisma.entitlement.update({
    where: { id: credit.id },
    data: { postId },
  });
  return true;
}

export async function getPostAccess(
  userId: string | null,
  postId: string,
  publicContent: string,
  paidContent: string | null,
  status: string
): Promise<PostAccessResult> {
  if (status === "PUBLISHED") {
    return { hasAccess: true, reason: "published", content: publicContent };
  }

  if (status !== "PAID_ONLY") {
    return { hasAccess: false, reason: "no_access", content: null };
  }

  if (!userId) {
    return { hasAccess: false, reason: "no_access", content: null };
  }

  const now = new Date();
  const fullContent = publicContent + "\n\n" + (paidContent || "");

  const vipEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "VIP",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  if (vipEntitlement) {
    return { hasAccess: true, reason: "vip_active", content: fullContent };
  }

  const postEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "PAID_POST",
      postId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  if (postEntitlement) {
    return { hasAccess: true, reason: "paid_post_entitled", content: fullContent };
  }

  const consumed = await consumeArticleCredit(userId, postId, now);
  if (consumed) {
    return { hasAccess: true, reason: "article_credit", content: fullContent };
  }

  return { hasAccess: false, reason: "no_access", content: null };
}

export async function getPostPrice(postId: string): Promise<{
  price: number | null;
  currency: string;
} | null> {
  const paidContent = await prisma.paidContent.findUnique({
    where: { postId },
    select: { price: true },
  });

  if (!paidContent) return null;

  return {
    price: Number(paidContent.price),
    currency: "CNY",
  };
}

export async function countArticleCredits(userId: string): Promise<number> {
  const now = new Date();
  return prisma.entitlement.count({
    where: {
      userId,
      type: "PAID_POST",
      postId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}