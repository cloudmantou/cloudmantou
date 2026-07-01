import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
  try {
    const category = await prisma.category.findUnique({
      where: { slug: slug },
      include: {
        _count: {
          select: {
            posts: { where: { status: "PUBLISHED" } },
          },
        },
      },
    });

    if (!category) {
      return fail("分类不存在", 40400, 404);
    }

    return ok({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      postCount: category._count.posts,
    });
  } catch (error) {
    console.error("[Category Detail API Error]", error);
    return fail("获取分类信息失败", 50000, 500);
  }
}
