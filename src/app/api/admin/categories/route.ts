import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "slug 只允许小写字母、数字和横线"),
  description: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    await requireAdmin();
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return ok(categories.map((c) => ({
      ...c,
      postCount: c._count.posts,
    })));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Categories List Error]", error);
    return fail("获取分类列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) {
      return fail("名称或 slug 已存在", 40900, 409);
    }

    const category = await prisma.category.create({ data });
    return ok({ id: category.id });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Create Category Error]", error);
    return fail("创建分类失败", 50000, 500);
  }
}
