import { prisma } from "@/lib/prisma";

export async function hasActiveVip(userId: string, now = new Date()): Promise<boolean> {
  const row = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "VIP",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function hasPostEntitlement(
  userId: string,
  postId: string,
  now = new Date()
): Promise<boolean> {
  const row = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: "PAID_POST",
      postId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** 未绑定的 PAID_POST 权益 = 文章券额度 */
export async function countArticleCredits(userId: string, now = new Date()): Promise<number> {
  return prisma.entitlement.count({
    where: {
      userId,
      type: "PAID_POST",
      postId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}