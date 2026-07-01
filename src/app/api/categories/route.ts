import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            posts: { where: { status: "PUBLISHED" } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return ok(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        postCount: c._count.posts,
      }))
    );
  } catch (error) {
    console.error("[Categories API Error]", error);
    return fail("获取分类列表失败", 50000, 500);
  }
}
