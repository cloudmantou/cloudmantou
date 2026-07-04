import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { dailyRecordCreateSchema } from "@/lib/daily-record-schema";
import { normalizeTagSlug } from "@/lib/tag-slug";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const filter = searchParams.get("filter") || "all";

    const where: Record<string, unknown> = {};
    if (filter === "top") where.isTop = true;
    if (filter === "photo") where.photos = { not: null };

    const [items, total] = await Promise.all([
      prisma.dailyRecord.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, nickname: true, avatar: true } },
          tags: { include: { tag: { select: { name: true } } } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: [{ isTop: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dailyRecord.count({ where }),
    ]);

    const data = items.map((r) => ({
      id: r.id,
      content: r.content,
      photos: r.photos ? JSON.parse(r.photos) : [],
      mood: r.mood,
      weather: r.weather,
      location: r.location,
      visibility: r.visibility,
      isTop: r.isTop,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      createdAt: r.createdAt,
      author: r.author,
      tagNames: r.tags.map((t) => t.tag.name),
      likesCount: r._count.likes,
      commentsCount: r._count.comments,
    }));

    return ok(data, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Daily Records List Error]", error);
    return fail("获取日常记录失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = dailyRecordCreateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { tagNames, photos, ...data } = parsed.data;

    const tagConnections: { tagId: string }[] = [];
    if (tagNames && tagNames.length > 0) {
      for (const name of tagNames) {
        const slug = normalizeTagSlug(name);
        if (!slug) {
          return fail("标签格式无效", 42200, 422);
        }
        const tag = await prisma.tag.findUnique({ where: { slug } });
        if (!tag) {
          return fail(`标签「${name.replace(/^#/, "")}」不存在，请先在标签管理创建`, 42200, 422);
        }
        tagConnections.push({ tagId: tag.id });
      }
    }

    const record = await prisma.dailyRecord.create({
      data: {
        ...data,
        authorId: session.user.id,
        photos: photos ? JSON.stringify(photos) : null,
        tags: tagConnections.length > 0 ? { create: tagConnections } : undefined,
      },
      include: {
        author: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
    });

    return ok({ id: record.id }, undefined, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Daily Record Create Error]", error);
    return fail("发布记录失败", 50000, 500);
  }
}