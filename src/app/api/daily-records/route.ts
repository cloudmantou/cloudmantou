import { ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const filter = searchParams.get("filter") || "all"; // all, photo, text, top

    const where: any = { visibility: "public" };
    if (filter === "top") where.isTop = true;
    if (filter === "photo") where.photos = { not: null };

    const [items, total] = await Promise.all([
      prisma.dailyRecord.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, nickname: true, avatar: true } },
          tags: { include: { tag: { select: { name: true } } } },
          _count: { select: { likes: true } },
        },
        orderBy: [{ isTop: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dailyRecord.count({ where }),
    ]);

    const data = items.map((r) => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : [],
      tagNames: r.tags.map((t) => t.tag.name),
      likesCount: r._count.likes,
      commentsCount: r.commentCount,
      tags: undefined,
      _count: undefined,
    }));

    return ok(data, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Daily Records List Error]", error);
    return fail("获取日常记录失败", 50000, 500);
  }
}


