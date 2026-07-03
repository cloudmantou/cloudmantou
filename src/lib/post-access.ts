import { prisma } from "@/lib/prisma";

export type PostAccessReason =
  | "published"
  | "vip_active"
  | "paid_post_entitled"
  | "article_credit"
  | "article_credit_available"
  | "no_access";

export type PostAccessResult = {
  hasAccess: boolean;
  reason: PostAccessReason;
  content: string | null;
  articleCreditsAvailable?: number;
};

export type UnlockPostResult =
  | { success: true; reason: "article_credit" }
  | { success: false; reason: "not_paid_post" | "no_credit" | "already_entitled" | "concurrent_conflict" | "unauthorized" };

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

async function hasVipAccess(userId: string, now: Date): Promise<boolean> {
  const vipEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "VIP",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(vipEntitlement);
}

async function hasPostEntitlement(userId: string, postId: string, now: Date): Promise<boolean> {
  const postEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "PAID_POST",
      postId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(postEntitlement);
}

/**
 * 只读访问判断：不在 GET 请求中消耗文章券。
 */
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

  if (await hasVipAccess(userId, now)) {
    return { hasAccess: true, reason: "vip_active", content: fullContent };
  }

  if (await hasPostEntitlement(userId, postId, now)) {
    return { hasAccess: true, reason: "paid_post_entitled", content: fullContent };
  }

  const credits = await countArticleCredits(userId);
  if (credits > 0) {
    return {
      hasAccess: false,
      reason: "article_credit_available",
      content: null,
      articleCreditsAvailable: credits,
    };
  }

  return { hasAccess: false, reason: "no_access", content: null };
}

/**
 * 显式消耗一张文章券并绑定到当前文章（原子条件更新）。
 */
export async function unlockPostWithArticleCredit(
  userId: string,
  postId: string
): Promise<UnlockPostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true },
  });

  if (!post || post.status !== "PAID_ONLY") {
    return { success: false, reason: "not_paid_post" };
  }

  const now = new Date();

  if (await hasVipAccess(userId, now) || (await hasPostEntitlement(userId, postId, now))) {
    return { success: false, reason: "already_entitled" };
  }

  return prisma.$transaction(async (tx) => {
    const credit = await tx.entitlement.findFirst({
      where: {
        userId,
        type: "PAID_POST",
        postId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!credit) {
      return { success: false, reason: "no_credit" } as const;
    }

    const updated = await tx.entitlement.updateMany({
      where: {
        id: credit.id,
        userId,
        type: "PAID_POST",
        postId: null,
      },
      data: { postId },
    });

    if (updated.count !== 1) {
      return { success: false, reason: "concurrent_conflict" } as const;
    }

    return { success: true, reason: "article_credit" } as const;
  });
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