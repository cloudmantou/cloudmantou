import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin, ApiError } from "@/lib/guards";
import { countActiveCardStock, serializeCardPackageLists } from "@/lib/card-packages";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "slug 仅支持小写字母、数字和连字符").optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  intro: z.string().max(8000).optional().nullable(),
  highlights: z.array(z.string().max(200)).max(12).optional(),
  usageSteps: z.array(z.string().max(300)).max(8).optional(),
  cardType: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE"]).optional(),
  cardValue: z.number().int().min(1).optional(),
  price: z.number().positive().optional(),
  badge: z.string().max(32).optional(),
  accent: z.string().max(32).optional(),
  cover: z.string().max(2000).optional().nullable(),
  enabled: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const existing = await prisma.cardPackage.findUnique({ where: { id } });
    if (!existing) {
      return fail("卡密商品不存在", 40400, 404);
    }

    const data = parsed.data;
    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await prisma.cardPackage.findUnique({ where: { slug: data.slug } });
      if (slugTaken) return fail("slug 已存在", 40900, 409);
    }

    const updated = await prisma.cardPackage.update({
      where: { id },
      data: {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.intro !== undefined && { intro: data.intro }),
        ...(data.highlights !== undefined && {
          highlights: serializeCardPackageLists({ highlights: data.highlights }).highlights ?? [],
        }),
        ...(data.usageSteps !== undefined && {
          usageSteps: serializeCardPackageLists({ usageSteps: data.usageSteps }).usageSteps ?? [],
        }),
        ...(data.cardType !== undefined && { cardType: data.cardType }),
        ...(data.cardValue !== undefined && { cardValue: data.cardValue }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.badge !== undefined && { badge: data.badge }),
        ...(data.accent !== undefined && { accent: data.accent }),
        ...(data.cover !== undefined && { cover: data.cover }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });

    const stock = await countActiveCardStock(prisma, updated.cardType, updated.cardValue);
    return ok({ ...updated, price: Number(updated.price), stock });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin CardPackages PUT]", error);
    return fail("更新卡密商品失败", 50000, 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const existing = await prisma.cardPackage.findUnique({ where: { id } });
    if (!existing) {
      return fail("卡密商品不存在", 40400, 404);
    }
    await prisma.cardPackage.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin CardPackages DELETE]", error);
    return fail("删除卡密商品失败", 50000, 500);
  }
}