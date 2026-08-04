import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import { coverImageSchema, postSlugSchema } from "@/lib/post-schema";
import {
  MAX_PAID_POST_CONTENT_LENGTH,
  isPublishedPostStatus,
  isValidPaidPostPrice,
  validatePaidPostMutation,
} from "@/lib/paid-post-publishing";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";

const createPostSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  slug: postSlugSchema,
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(1, "内容不能为空"),
  coverImage: coverImageSchema,
  categoryId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PAID_ONLY"]).default("DRAFT"),
  isTop: z.boolean().default(false),
  paidContent: z.object({
    content: z.string().trim().min(1, "付费内容不能为空").max(
      MAX_PAID_POST_CONTENT_LENGTH,
      "付费内容过长",
    ),
    price: z.number().refine(
      isValidPaidPostPrice,
      "付费价格必须是大于等于 0.01 的两位小数",
    ),
  }).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const q = searchParams.get("q") || undefined;

    const where: any = {
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(q && {
        OR: [
          { title: { contains: q } },
          { excerpt: { contains: q } },
        ],
      }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, nickname: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
          paidContent: { select: { price: true } },
        },
        orderBy: [{ isTop: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    const formatted = posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
      paidContent: p.paidContent
        ? { price: Number(p.paidContent.price) }
        : null,
    }));

    return ok(formatted, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Posts List Error]", error);
    return fail("获取文章列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "posts.create");
    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    const paidPostError = validatePaidPostMutation({
      status: data.status,
      paidContent: data.paidContent,
    });
    if (paidPostError) {
      return fail(paidPostError, 42200, 422);
    }

    // Check slug uniqueness
    const existing = await prisma.post.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return fail("slug 已存在，请换一个", 40900, 409);
    }

    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt || null,
          content: data.content,
          coverImage: data.coverImage || null,
          authorId: session.user.id,
          categoryId: data.categoryId || null,
          status: data.status,
          isTop: data.isTop,
          publishedAt: isPublishedPostStatus(data.status) ? new Date() : null,
        },
      });

      // Create tag relations
      if (data.tagIds && data.tagIds.length > 0) {
        await tx.postTag.createMany({
          data: data.tagIds.map((tagId) => ({
            postId: newPost.id,
            tagId,
          })),
        });
      }

      // A draft may keep a complete paid section until it is published.
      if (data.paidContent) {
        await tx.paidContent.create({
          data: {
            postId: newPost.id,
            content: data.paidContent.content,
            price: data.paidContent.price,
          },
        });
      }

      return newPost;
    });

    return ok({ id: post.id, slug: post.slug });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    if (isPrismaUniqueConstraintError(error, "slug")) {
      return fail("slug 已存在，请换一个", 40900, 409);
    }
    console.error("[Admin Create Post Error]", error);
    return fail("创建文章失败", 50000, 500);
  }
}
