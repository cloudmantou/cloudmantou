import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(30),
  slug: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/, "slug 只允许小写字母、数字和横线"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export async function GET() {
  try {
    await requireAdmin();
    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: "asc" },
    });
    return ok(tags.map((t) => ({
      ...t,
      postCount: t._count.posts,
    })));
  } catch (error) {
    console.error("[Admin Tags List Error]", error);
    return fail("获取标签列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = parsed.data;
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) {
      return fail("名称或 slug 已存在", 40900, 409);
    }

    const tag = await prisma.tag.create({ data });
    return ok({ id: tag.id });
  } catch (error) {
    console.error("[Admin Create Tag Error]", error);
    return fail("创建标签失败", 50000, 500);
  }
}
