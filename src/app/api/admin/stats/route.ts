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

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPublished = await prisma.post.findMany({
      where: { publishedAt: { gte: weekAgo }, status: { in: ["PUBLISHED", "PAID_ONLY"] } },
      select: { publishedAt: true, viewCount: true },
    });

    const dayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const visitTrend = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - i));
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const posts = recentPublished.filter(
        (p) => p.publishedAt && p.publishedAt >= day && p.publishedAt < next
      );
      const views = posts.reduce((sum, p) => sum + p.viewCount, 0);
      return {
        label: dayLabels[day.getDay()],
        value: views || posts.length * 12,
      };
    });
    const maxVisit = Math.max(...visitTrend.map((d) => d.value), 1);
    const visitTrendNormalized = visitTrend.map((d) => ({
      ...d,
      height: Math.round((d.value / maxVisit) * 100),
    }));

    const revenueByType = await prisma.order.groupBy({
      by: ["productType"],
      _sum: { amount: true },
      where: { status: "PAID" },
    });
    const revenueTotal = revenueByType.reduce(
      (sum, r) => sum + Number(r._sum.amount || 0),
      0
    );
    const revenueBreakdown = revenueByType.map((r) => ({
      type: r.productType,
      amount: Number(r._sum.amount || 0),
      percent: revenueTotal
        ? Math.round((Number(r._sum.amount || 0) / revenueTotal) * 100)
        : 0,
    }));

    const activeMembers = await prisma.user.count({
      where: { vipExpireAt: { gt: new Date() } },
    });

    const activity: Array<{
      type: string;
      color: string;
      text: string;
      time: string;
    }> = [];

    for (const order of recentOrders.slice(0, 2)) {
      activity.push({
        type: "order",
        color: "var(--teal)",
        text: `${order.user.nickname || order.user.username} 完成了订单 ${order.orderNo}`,
        time: order.createdAt.toISOString(),
      });
    }
    for (const comment of recentComments.filter((c) => c.status === "PENDING").slice(0, 2)) {
      activity.push({
        type: "comment",
        color: "var(--orange)",
        text: `${comment.user.nickname || comment.user.username} 的评论待审核`,
        time: comment.createdAt.toISOString(),
      });
    }
    for (const post of recentPosts.filter((p) => p.status === "PUBLISHED").slice(0, 2)) {
      activity.push({
        type: "post",
        color: "var(--accent)",
        text: `文章《${post.title}》已更新`,
        time: post.publishedAt?.toISOString() || "",
      });
    }

    return ok({
      metrics: {
        posts: totalPosts,
        users: totalUsers,
        orders: totalOrders,
        revenue: totalRevenue,
        pendingComments,
        activeCards,
        activeMembers,
      },
      attention,
      recentPosts,
      recentOrders,
      recentComments,
      cardStats: cardStats.map((s) => ({ status: s.status, count: s._count })),
      visitTrend: visitTrendNormalized,
      revenueBreakdown,
      activity: activity.slice(0, 6),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Stats Error]", error);
    return fail("获取统计数据失败", 50000, 500);
  }
}
