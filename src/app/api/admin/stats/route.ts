import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAdmin();
    const [totalPosts, totalUsers, totalOrders, pendingComments, activeCards, pendingOrders] =
      await Promise.all([
        prisma.post.count(),
        prisma.user.count(),
        prisma.order.count({ where: { status: "PAID" } }),
        prisma.comment.count({ where: { status: "PENDING" } }),
        prisma.card.count({ where: { status: "ACTIVE" } }),
        prisma.order.count({ where: { status: "PENDING" } }),
      ]);

    // 计算总收入
    const revenueResult = await prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    });
    const totalRevenue = Number(revenueResult._sum.amount || 0);

    // 待处理事项
    const attention = [];
    if (pendingComments > 0) {
      attention.push({
        type: "warning",
        title: `${pendingComments} 条评论待审核`,
        link: "/admin/comments",
      });
    }
    if (pendingOrders > 0) {
      attention.push({
        type: "info",
        title: `${pendingOrders} 笔订单待处理`,
        link: "/admin/orders",
      });
    }
    if (totalPosts === 0) {
      attention.push({
        type: "info",
        title: "暂无文章，去发布第一篇吧",
        link: "/admin/posts/new",
      });
    }

    // 最近文章
    const recentPosts = await prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        viewCount: true,
        commentCount: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });

    // 最近订单
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNo: true,
        title: true,
        amount: true,
        status: true,
        createdAt: true,
        user: { select: { username: true, nickname: true } },
      },
    });

    // 最近评论
    const recentComments = await prisma.comment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        user: { select: { username: true, nickname: true } },
        post: { select: { title: true } },
      },
    });

    // 卡密统计
    const cardStats = await prisma.card.groupBy({
      by: ["status"],
      _count: true,
    });

    return ok({
      metrics: {
        posts: totalPosts,
        users: totalUsers,
        orders: totalOrders,
        revenue: totalRevenue,
        pendingComments,
        activeCards,
      },
      attention,
      recentPosts,
      recentOrders,
      recentComments,
      cardStats: cardStats.map((s) => ({ status: s.status, count: s._count })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Stats Error]", error);
    return fail("获取统计数据失败", 50000, 500);
  }
}
