import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const updateTagSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  slug: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id: id } });
    if (!tag) {
      return fail("标签不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updateTagSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    if (data.name || data.slug) {
      const existing = await prisma.tag.findFirst({
        where: {
          id: { not: id },
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

    await prisma.tag.update({ where: { id: id }, data });
    return ok({ id: id });
  } catch (error) {
    console.error("[Admin Update Tag Error]", error);
    return fail("更新标签失败", 50000, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id: id } });
    if (!tag) {
      return fail("标签不存在", 40400, 404);
    }

    await prisma.tag.delete({ where: { id: id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[Admin Delete Tag Error]", error);
    return fail("删除标签失败", 50000, 500);
  }
}
