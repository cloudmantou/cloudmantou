import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAdmin();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    // 所有统计互不依赖，并行查询，避免仪表盘串行等待十余次数据库往返。
    const [
      totalPosts,
      totalUsers,
      totalOrders,
      pendingComments,
      activeCards,
      pendingOrders,
      revenueResult,
      recentPosts,
      recentOrders,
      recentComments,
      cardStats,
      recentPublished,
      revenueByType,
      activeMembers,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.user.count(),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.comment.count({ where: { status: "PENDING" } }),
      prisma.card.count({ where: { status: "ACTIVE" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.post.findMany({
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
          updatedAt: true,
          category: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        take: 5,
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          orderNo: true,
          title: true,
          amount: true,
          status: true,
          paidAt: true,
          createdAt: true,
          user: { select: { username: true, nickname: true } },
        },
      }),
      prisma.comment.findMany({
        take: 5,
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
          user: { select: { username: true, nickname: true } },
          post: { select: { title: true } },
        },
      }),
      prisma.card.groupBy({ by: ["status"], _count: true }),
      prisma.post.findMany({
        where: { publishedAt: { gte: weekStart }, status: { in: ["PUBLISHED", "PAID_ONLY"] } },
        select: { publishedAt: true },
      }),
      prisma.order.groupBy({
        by: ["productType"],
        _sum: { amount: true },
        where: { status: "PAID" },
      }),
      prisma.user.count({ where: { vipExpireAt: { gt: new Date() } } }),
    ]);

    const totalRevenue = Number(revenueResult._sum.amount || 0);

    // 待处理事项：只列出真正需要管理员动作的内容。
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
        title: `${pendingOrders} 笔订单等待用户支付`,
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

    // 站点没有访问日志表，因此不再用累计浏览量伪造“访问趋势”，改为真实的近 7 天发布数。
    const dayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const publishTrend = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const value = recentPublished.filter(
        (p) => p.publishedAt && p.publishedAt >= day && p.publishedAt < next
      ).length;
      return { label: dayLabels[day.getDay()], value };
    });
    const maxPublished = Math.max(...publishTrend.map((d) => d.value), 1);
    const publishTrendNormalized = publishTrend.map((d) => ({
      ...d,
      height: Math.round((d.value / maxPublished) * 100),
    }));

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

    const activity: Array<{
      type: string;
      color: string;
      text: string;
      time: string;
    }> = [];

    for (const order of recentOrders.slice(0, 3)) {
      activity.push({
        type: "order",
        color: "var(--teal)",
        text: `${order.user.nickname || order.user.username} 支付了订单 ${order.orderNo}`,
        time: (order.paidAt || order.createdAt).toISOString(),
      });
    }
    for (const comment of recentComments.slice(0, 3)) {
      activity.push({
        type: "comment",
        color: "var(--orange)",
        text: `${comment.user.nickname || comment.user.username} 在《${comment.post.title}》的评论待审核`,
        time: comment.createdAt.toISOString(),
      });
    }
    // 撤回为草稿的文章仍保留 publishedAt，不能当作“已发布”动态。
    for (const post of recentPosts.filter((p) => p.publishedAt && p.status !== "DRAFT").slice(0, 3)) {
      activity.push({
        type: "post",
        color: "var(--accent)",
        text: `文章《${post.title}》已发布`,
        time: post.publishedAt!.toISOString(),
      });
    }
    activity.sort((a, b) => b.time.localeCompare(a.time));

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
      recentOrders: recentOrders.map((o) => ({ ...o, amount: Number(o.amount) })),
      recentComments,
      cardStats: cardStats.map((s) => ({ status: s.status, count: s._count })),
      publishTrend: publishTrendNormalized,
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
