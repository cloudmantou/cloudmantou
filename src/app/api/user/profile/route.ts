import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { countArticleCredits } from "@/lib/post-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        role: true,
        vipLevel: true,
        vipExpireAt: true,
        balance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return fail("用户不存在", 40400, 404);
    }

    const [articleCredits, unlockedPosts, orderCount] = await Promise.all([
      countArticleCredits(session.user.id),
      prisma.entitlement.count({
        where: {
          userId: session.user.id,
          type: "PAID_POST",
          postId: { not: null },
        },
      }),
      prisma.order.count({ where: { userId: session.user.id } }),
    ]);

    const now = new Date();
    const vipActive = Boolean(user.vipExpireAt && user.vipExpireAt > now);

    return ok({
      ...user,
      vipExpireAt: user.vipExpireAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      vipActive,
      articleCredits,
      unlockedPosts,
      orderCount,
    });
  } catch (error) {
    console.error("[User Profile Error]", error);
    return fail("获取用户信息失败", 50000, 500);
  }
}