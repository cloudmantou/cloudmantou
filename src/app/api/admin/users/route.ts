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

    const [items, total] = await Promise.all([
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
    ]);

    return ok(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Users List Error]", error);
    return fail("获取用户列表失败", 50000, 500);
  }
}
