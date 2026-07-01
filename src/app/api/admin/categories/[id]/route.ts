import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = await prisma.category.findUnique({ where: { id: params.id } });
    if (!category) {
      return fail("分类不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;

    // Check uniqueness if name or slug changed
    if (data.name || data.slug) {
      const existing = await prisma.category.findFirst({
        where: {
          id: { not: params.id },
          OR: [
            ...(data.name ? [{ name: data.name }] : []),
            ...(data.slug ? [{ slug: data.slug }] : []),
          ],
        },
      });
      if (existing) {
        return fail("名称或 slug 已存在", 40900, 409);
      }
    }

    await prisma.category.update({ where: { id: params.id }, data });
    return ok({ id: params.id });
  } catch (error) {
    console.error("[Admin Update Category Error]", error);
    return fail("更新分类失败", 50000, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { posts: true } } },
    });
    if (!category) {
      return fail("分类不存在", 40400, 404);
    }
    if (category._count.posts > 0) {
      return fail("该分类下还有文章，请先移除", 40000, 400);
    }

    await prisma.category.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[Admin Delete Category Error]", error);
    return fail("删除分类失败", 50000, 500);
  }
}
