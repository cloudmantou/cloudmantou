import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const soldWhere = {
      OR: [{ status: "USED" as const }, { orderId: { not: null } }],
    };
    const availableWhere = {
      status: "ACTIVE" as const,
      orderId: null,
    };

    const [total, used, active, disabled, expired, weekNew, revenueResult, byPackage, batches] =
      await Promise.all([
        prisma.card.count(),
        prisma.card.count({ where: soldWhere }),
        prisma.card.count({ where: availableWhere }),
        prisma.card.count({ where: { status: "DISABLED" } }),
        prisma.card.count({ where: { status: "EXPIRED" } }),
        prisma.card.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.order.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
        prisma.card.groupBy({
          by: ["packageId", "status"],
          where: { packageId: { not: null } },
          _count: true,
        }),
        prisma.card.groupBy({
          by: ["batchNo"],
          _count: true,
          _min: { createdAt: true },
          orderBy: { _min: { createdAt: "desc" } },
          take: 20,
        }),
      ]);

    const productMap = new Map<
      string,
      { packageId: string; total: number; active: number; used: number }
    >();

    for (const row of byPackage) {
      if (!row.packageId) continue;
      const existing = productMap.get(row.packageId) || {
        packageId: row.packageId,
        total: 0,
        active: 0,
        used: 0,
      };
      existing.total += row._count;
      if (row.status === "ACTIVE") existing.active += row._count;
      if (row.status === "USED") existing.used += row._count;
      productMap.set(row.packageId, existing);
    }

    return ok({
      total,
      used,
      active,
      disabled,
      expired,
      weekNew,
      revenue: Number(revenueResult._sum.amount || 0),
      sellRate: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      products: Array.from(productMap.values()).sort((a, b) => b.total - a.total).map((p) => ({
        packageId: p.packageId,
        total: p.total,
        active: p.active,
        used: p.used,
      })),
      batches: batches
        .filter((b) => b.batchNo)
        .map((b) => ({
          batchNo: b.batchNo,
          count: b._count,
          createdAt: b._min.createdAt,
        })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Cards Stats Error]", error);
    return fail("获取卡密统计失败", 50000, 500);
  }
}