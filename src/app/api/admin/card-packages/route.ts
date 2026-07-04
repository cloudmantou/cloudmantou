import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import {
  countActiveCardStock,
  DEFAULT_CARD_PACKAGE_TEMPLATES,
  serializeCardPackageLists,
} from "@/lib/card-packages";
import { coverImageSchema } from "@/lib/post-schema";

export const dynamic = "force-dynamic";

const packageSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "slug 仅支持小写字母、数字和连字符"),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  intro: z.string().max(8000).optional().nullable(),
  highlights: z.array(z.string().max(200)).max(12).optional(),
  usageSteps: z.array(z.string().max(300)).max(8).optional(),
  cardType: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE", "GENERIC"]),
  redemptionNote: z.string().max(500).optional().nullable(),
  cardValue: z.number().int().min(1),
  price: z.number().min(0.01),
  badge: z.string().max(32).optional(),
  accent: z.string().max(32).optional(),
  cover: coverImageSchema,
  enabled: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function listPackagesWithStock() {
  const packages = await prisma.cardPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const stockRows = await prisma.card.groupBy({
    by: ["packageId"],
    where: { status: "ACTIVE", orderId: null, packageId: { not: null } },
    _count: true,
  });

  const stockMap = new Map<string, number>();
  for (const row of stockRows) {
    if (row.packageId) {
      stockMap.set(row.packageId, row._count);
    }
  }

  return packages.map((pkg) => ({
    ...pkg,
    price: Number(pkg.price),
    highlights: pkg.highlights,
    usageSteps: pkg.usageSteps,
    stock: stockMap.get(pkg.id) || 0,
  }));
}

export async function GET() {
  try {
    await requireAdmin();

    let count = await prisma.cardPackage.count();
    if (count === 0) {
      for (const template of DEFAULT_CARD_PACKAGE_TEMPLATES) {
        const lists = serializeCardPackageLists(template);
        await prisma.cardPackage.create({
          data: {
            slug: template.slug,
            name: template.name,
            description: template.description,
            intro: template.intro,
            highlights: lists.highlights,
            usageSteps: lists.usageSteps,
            cardType: template.cardType,
            cardValue: template.cardValue,
            price: template.price,
            badge: template.badge || "NEW",
            accent: template.accent || "gold",
            cover: template.cover,
            sortOrder: template.sortOrder ?? 0,
            published: false,
          },
        });
      }
    }

    return ok(await listPackagesWithStock());
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin CardPackages GET]", error);
    return fail("获取卡密商品失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAndAudit(req, "card_packages.create");
    const body = await req.json();
    const parsed = packageSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    const lists = serializeCardPackageLists(data);
    const existingSlug = await prisma.cardPackage.findUnique({ where: { slug: data.slug } });
    if (existingSlug) {
      return fail("slug 已存在", 40900, 409);
    }

    const created = await prisma.cardPackage.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        intro: data.intro || null,
        highlights: lists.highlights,
        usageSteps: lists.usageSteps,
        cardType: data.cardType,
        cardValue: data.cardValue,
        price: data.price,
        badge: data.badge || "NEW",
        accent: data.accent || "gold",
        cover: data.cover || null,
        redemptionNote: data.redemptionNote || null,
        enabled: data.enabled ?? true,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    const stock = await countActiveCardStock(prisma, created.id);
    return ok({ ...created, price: Number(created.price), stock });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin CardPackages POST]", error);
    return fail("创建卡密商品失败", 50000, 500);
  }
}