import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(1).optional(),
  coverImage: z.string().url().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PAID_ONLY"]).optional(),
  isTop: z.boolean().optional(),
  paidContent: z.object({
    content: z.string().min(1),
    price: z.number().min(0.01),
  }).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {
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
    const post = await prisma.post.findUnique({ where: { id: id } });
    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;

    // Check slug uniqueness if changed
    if (data.slug && data.slug !== post.slug) {
      const existing = await prisma.post.findUnique({ where: { slug: data.slug } });
      if (existing) {
        return fail("slug 已存在", 40900, 409);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update post
      await tx.post.update({
        where: { id: id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.status !== undefined && {
            status: data.status,
            publishedAt:
              data.status === "PUBLISHED" && !post.publishedAt
                ? new Date()
                : post.publishedAt,
          }),
          ...(data.isTop !== undefined && { isTop: data.isTop }),
        },
      });

      // Update tags if provided
      if (data.tagIds !== undefined) {
        await tx.postTag.deleteMany({ where: { postId: id } });
        if (data.tagIds.length > 0) {
          await tx.postTag.createMany({
            data: data.tagIds.map((tagId) => ({ postId: id, tagId })),
          });
        }
      }

      // Update paid content
      if (data.paidContent !== undefined) {
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

    return ok({ id: id });
  } catch (error) {
    console.error("[Admin Update Post Error]", error);
    return fail("更新文章失败", 50000, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {
    const post = await prisma.post.findUnique({ where: { id: id } });
    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    await prisma.post.delete({ where: { id: id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[Admin Delete Post Error]", error);
    return fail("删除文章失败", 50000, 500);
  }
}
