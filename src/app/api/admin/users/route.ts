import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const q = searchParams.get("q") || undefined;
    const role = searchParams.get("role") || undefined;

    const where: any = {
      ...(role && { role }),
      ...(q && {
        OR: [
          { username: { contains: q } },
          { email: { contains: q } },
          { nickname: { contains: q } },
        ],
      }),
    };

    const now = new Date();
    const [items, total, roleCounts, activeVip] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          nickname: true,
          role: true,
          vipLevel: true,
          vipExpireAt: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true, orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.user.count({ where: { vipExpireAt: { gt: now } } }),
    ]);

    // 汇总基于全站而不是当前页，避免“管理员 / VIP”数字随翻页变化。
    const countOf = (r: string) => roleCounts.find((c) => c.role === r)?._count ?? 0;
    return ok(
      {
        items,
        summary: {
          total: roleCounts.reduce((sum, c) => sum + c._count, 0),
          admins: countOf("ADMIN"),
          editors: countOf("EDITOR"),
          activeVip,
        },
      },
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Users List Error]", error);
    return fail("获取用户列表失败", 50000, 500);
  }
}
