import { prisma } from "@/lib/prisma";
import type { AccessDecision } from "@/lib/access/types";
import {
  countArticleCredits,
  hasActiveVip,
  hasPostEntitlement,
} from "@/lib/access/entitlements";

export type UnlockPostResult =
  | { success: true; reason: "article_credit" }
  | {
      success: false;
      reason:
        | "not_paid_post"
        | "no_credit"
        | "already_entitled"
        | "concurrent_conflict"
        | "unauthorized";
    };

function buildFullContent(publicContent: string, paidContent: string | null): string {
  return publicContent + "\n\n" + (paidContent || "");
}

/**
 * 只读权限决策 — 不在 GET 请求中写入数据库。
 */
export async function decidePostAccess(input: {
  userId: string | null;
  postId: string;
  publicContent: string;
  paidContent: string | null;
  status: string;
}): Promise<AccessDecision> {
  const { userId, postId, publicContent, paidContent, status } = input;

  if (status === "PUBLISHED") {
    return {
      allowed: true,
      reason: "PUBLIC",
      requiresUnlock: false,
      content: publicContent,
    };
  }

  if (status !== "PAID_ONLY") {
    return {
      allowed: false,
      reason: "NONE",
      requiresUnlock: false,
      content: null,
    };
  }

  if (!userId) {
    return {
      allowed: false,
      reason: "NONE",
      requiresUnlock: false,
      content: null,
    };
  }

  const now = new Date();
  const fullContent = buildFullContent(publicContent, paidContent);

  const [vip, entitled, credits] = await Promise.all([
    hasActiveVip(userId, now),
    hasPostEntitlement(userId, postId, now),
    countArticleCredits(userId, now),
  ]);

  if (vip) {
    return {
      allowed: true,
      reason: "VIP",
      requiresUnlock: false,
      content: fullContent,
    };
  }

  if (entitled) {
    return {
      allowed: true,
      reason: "POST_ENTITLEMENT",
      requiresUnlock: false,
      content: fullContent,
    };
  }
  if (credits > 0) {
    return {
      allowed: false,
      reason: "ARTICLE_CREDIT_AVAILABLE",
      requiresUnlock: true,
      content: null,
      articleCreditsAvailable: credits,
    };
  }

  return {
    allowed: false,
    reason: "NONE",
    requiresUnlock: false,
    content: null,
  };
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

  if (
    (await hasActiveVip(userId, now)) ||
    (await hasPostEntitlement(userId, postId, now))
  ) {
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