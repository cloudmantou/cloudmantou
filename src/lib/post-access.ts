import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export type PostAccessResult = {
  hasAccess: boolean;
  reason: "published" | "vip_active" | "paid_post_entitled" | "no_access";
  content: string | null; // null = locked
};

/**
 * 统一文章访问权限判断
 * 被 SSR 页面和 API 路由共同调用，保证逻辑一致
 *
 * @param userId 当前用户 ID（null = 未登录）
 * @param postId 文章 ID
 * @param publicContent 公开部分内容
 * @param paidContent 付费部分内容
 * @param status 文章状态
 */
export async function getPostAccess(
  userId: string | null,
  postId: string,
  publicContent: string,
  paidContent: string | null,
  status: string
): Promise<PostAccessResult> {
  // PUBLISHED 文章：所有人可访问
  if (status === "PUBLISHED") {
    return { hasAccess: true, reason: "published", content: publicContent };
  }

  // PAID_ONLY 文章：需要权益
  if (status !== "PAID_ONLY") {
    return { hasAccess: false, reason: "no_access", content: null };
  }

  // 未登录：无法解锁
  if (!userId) {
    return { hasAccess: false, reason: "no_access", content: null };
  }

  const now = new Date();

  // 检查 1: VIP 权益（有效期内）
  const vipEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "VIP",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  if (vipEntitlement) {
    return {
      hasAccess: true,
      reason: "vip_active",
      content: publicContent + "\n\n" + (paidContent || ""),
    };
  }

  // 检查 2: 该文章的 PAID_POST 权益（有效期内）
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
    return {
      hasAccess: true,
      reason: "paid_post_entitled",
      content: publicContent + "\n\n" + (paidContent || ""),
    };
  }

  return { hasAccess: false, reason: "no_access", content: null };
}

/**
 * 获取付费文章的价格信息
 */
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
