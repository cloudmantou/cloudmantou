import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import { coverImageSchema, postSeoFieldsSchema, postSlugSchema } from "@/lib/post-schema";
import {
  MAX_PAID_POST_CONTENT_LENGTH,
  isPublishedPostStatus,
  isValidPaidPostPrice,
  validatePaidPostMutation,
} from "@/lib/paid-post-publishing";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: postSlugSchema.optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(1).max(100_000, "公开正文最多 100000 个字符").optional(),
  coverImage: coverImageSchema,
  categoryId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PAID_ONLY"]).optional(),
  isTop: z.boolean().optional(),
  paidContent: z.object({
    content: z.string().trim().min(1, "付费内容不能为空").max(
      MAX_PAID_POST_CONTENT_LENGTH,
      "付费内容过长",
    ),
    price: z.number().refine(
      isValidPaidPostPrice,
      "付费价格必须是大于等于 0.01 的两位小数",
    ),
  }).optional().nullable(),
  ...postSeoFieldsSchema.shape,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const post = await prisma.post.findUnique({
      where: { id: id },
      include: {
        author: { select: { id: true, username: true, nickname: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        paidContent: { select: { content: true, price: true } },
      },
    });

    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    return ok({
      ...post,
      tags: post.tags.map((pt) => pt.tag),
      paidContent: post.paidContent
        ? { content: post.paidContent.content, price: Number(post.paidContent.price) }
        : null,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Get Post Error]", error);
    return fail("获取文章失败", 50000, 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdminAndAudit(req, "posts.update", { targetType: "post", targetId: id });
    const post = await prisma.post.findUnique({
      where: { id: id },
      include: { paidContent: { select: { id: true } } },
    });
    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    const effectiveStatus = data.status ?? post.status;
    const translationSourceChanged = [
      data.title !== undefined && data.title !== post.title,
      data.excerpt !== undefined && data.excerpt !== post.excerpt,
      data.content !== undefined && data.content !== post.content,
      data.seoTitle !== undefined && data.seoTitle !== post.seoTitle,
      data.seoDescription !== undefined && data.seoDescription !== post.seoDescription,
      data.seoKeywords !== undefined
        && JSON.stringify(data.seoKeywords || []) !== JSON.stringify(post.seoKeywords || []),
      data.socialTitle !== undefined && data.socialTitle !== post.socialTitle,
      data.socialDescription !== undefined && data.socialDescription !== post.socialDescription,
      data.status !== undefined && data.status !== post.status,
    ].some(Boolean);
    const paidPostError = validatePaidPostMutation({
      status: effectiveStatus,
      paidContent: data.paidContent,
      hasExistingPaidContent: Boolean(post.paidContent),
    });
    if (paidPostError) {
      return fail(paidPostError, 42200, 422);
    }

    // Check slug uniqueness if changed
    if (data.slug && data.slug !== post.slug) {
      const existing = await prisma.post.findUnique({ where: { slug: data.slug } });
      if (existing) {
        return fail("slug 已存在", 40900, 409);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update post
      const nextUpdatedAt = new Date(
        Math.max(Date.now(), post.updatedAt.getTime() + 1),
      );
      const updateResult = await tx.post.updateMany({
        where: { id, updatedAt: post.updatedAt },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
          ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
          ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
          ...(data.seoKeywords !== undefined && { seoKeywords: data.seoKeywords || [] }),
          ...(data.socialTitle !== undefined && { socialTitle: data.socialTitle }),
          ...(data.socialDescription !== undefined && { socialDescription: data.socialDescription }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.status !== undefined && {
            status: data.status,
            publishedAt:
              isPublishedPostStatus(data.status) && !post.publishedAt
                ? new Date()
                : post.publishedAt,
          }),
          ...(data.isTop !== undefined && { isTop: data.isTop }),
          updatedAt: nextUpdatedAt,
        },
      });
      if (updateResult.count !== 1) {
        throw new ApiError("文章已被其他操作更新，请刷新后重试", 40901, 409);
      }

      if (translationSourceChanged) {
        await tx.postTranslation.updateMany({
          where: { postId: id },
          data: { status: "STALE" },
        });
      }

      // Update tags if provided
      if (data.tagIds !== undefined) {
        await tx.postTag.deleteMany({ where: { postId: id } });
        if (data.tagIds.length > 0) {
          await tx.postTag.createMany({
            data: data.tagIds.map((tagId) => ({ postId: id, tagId })),
          });
        }
      }

      // Public posts must never retain a paid section, including direct API updates.
      if (effectiveStatus === "PUBLISHED") {
        await tx.paidContent.deleteMany({ where: { postId: id } });
      } else if (data.paidContent !== undefined) {
        await tx.paidContent.deleteMany({ where: { postId: id } });
        if (data.paidContent) {
          await tx.paidContent.create({
            data: {
              postId: id,
              content: data.paidContent.content,
              price: data.paidContent.price,
            },
          });
        }
      }
    });

    return ok({ id, translationSourceChanged });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    if (isPrismaUniqueConstraintError(error, "slug")) {
      return fail("slug 已存在", 40900, 409);
    }
    console.error("[Admin Update Post Error]", error);
    return fail("更新文章失败", 50000, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdminAndAudit(req, "posts.delete", { targetType: "post", targetId: id });
    const post = await prisma.post.findUnique({ where: { id: id } });
    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    await prisma.post.delete({ where: { id: id } });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Delete Post Error]", error);
    return fail("删除文章失败", 50000, 500);
  }
}
