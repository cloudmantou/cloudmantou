import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(30),
  slug: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/, "slug 只允许小写字母、数字和横线"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  reuseExisting: z.boolean().optional().default(false),
});

function normalizeTagName(name: string) {
  return name.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

type TagConflict = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

function resolveTagConflict(
  conflicts: TagConflict[],
  data: { name: string; slug: string },
  reuseExisting: boolean,
) {
  const requestedName = normalizeTagName(data.name);
  const nameConflict = conflicts.find((tag) => normalizeTagName(tag.name) === requestedName);
  const slugConflict = conflicts.find((tag) => tag.slug === data.slug);

  if (nameConflict && slugConflict && nameConflict.id !== slugConflict.id) {
    return fail("slug 已被其他标签使用", 40900, 409);
  }
  if (nameConflict) {
    return reuseExisting
      ? ok({
          id: nameConflict.id,
          name: nameConflict.name,
          slug: nameConflict.slug,
          color: nameConflict.color,
          reused: true,
        })
      : fail("标签名称已存在", 40900, 409);
  }
  if (slugConflict) {
    return fail("slug 已被其他标签使用", 40900, 409);
  }
  return null;
}

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
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Tags List Error]", error);
    return fail("获取标签列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAndAudit(req, "tags.create");
    const body = await req.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { reuseExisting, ...data } = parsed.data;
    const conflicts = await prisma.tag.findMany({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    const conflictResponse = resolveTagConflict(conflicts, data, reuseExisting);
    if (conflictResponse) return conflictResponse;

    let tag;
    try {
      tag = await prisma.tag.create({ data });
    } catch (error) {
      const racedOnUniqueField = isPrismaUniqueConstraintError(error, "name")
        || isPrismaUniqueConstraintError(error, "slug");
      if (!racedOnUniqueField) throw error;

      const racedConflicts = await prisma.tag.findMany({
        where: { OR: [{ name: data.name }, { slug: data.slug }] },
      });
      const racedResponse = resolveTagConflict(racedConflicts, data, reuseExisting);
      if (racedResponse) return racedResponse;
      return fail("标签名称或 slug 已存在", 40900, 409);
    }
    return ok({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Create Tag Error]", error);
    return fail("创建标签失败", 50000, 500);
  }
}
