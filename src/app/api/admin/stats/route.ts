import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET() {
  try {
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

    // 最近7天每日注册用户数
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRegistrations = await prisma.user.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });

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

    return ok({
      metrics: {
        posts: totalPosts,
        users: totalUsers,
        orders: totalOrders,
        revenue: totalRevenue,
      },
      attention,
    });
  } catch (error) {
    console.error("[Admin Stats Error]", error);
    return fail("获取统计数据失败", 50000, 500);
  }
}
