import { requireAuth, requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1, "内容不能为空").max(2000, "内容不能超过2000字"),
  photos: z.array(z.string()).max(9, "最多上传9张图片").optional(),
  mood: z.string().max(10).optional(),
  weather: z.string().max(10).optional(),
  location: z.string().max(100).optional(),
  visibility: z.enum(["public", "link", "private", "friends"]).optional(),
  tagNames: z.array(z.string()).max(10).optional(),
});

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

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { tagNames, photos, ...data } = parsed.data;

    // Resolve or create tags
    const tagConnections: { tagId: string }[] = [];
    if (tagNames && tagNames.length > 0) {
      for (const name of tagNames) {
        const slug = name.replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
        const tag = await prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name: name.replace(/^#/, ""), slug },
        });
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
    console.error("[Daily Record Create Error]", error);
    return fail("发布记录失败", 50000, 500);
  }
}
