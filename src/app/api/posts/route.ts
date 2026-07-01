import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

/** Extract a snippet around the first match of `q` in `text` */
function extractSnippet(text: string, q: string, radius = 80): string | null {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  const snippet = text.slice(start, end).replace(/\n/g, " ");
  return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10")));
    const categoryId = searchParams.get("categoryId") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const q = searchParams.get("q") || undefined;

    const where: any = {
      status: "PUBLISHED",
      ...(categoryId && { categoryId }),
      ...(tag && {
        tags: { some: { tag: { slug: tag } } },
      }),
      ...(q && {
        OR: [
          { title: { contains: q } },
          { excerpt: { contains: q } },
          { content: { contains: q } },
        ],
      }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, nickname: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
        },
        orderBy: [
          { isTop: "desc" },
          { publishedAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    const formatted = posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
      // Include matched content snippet when searching
      ...(q
        ? {
            matchedContent:
              extractSnippet(p.content, q) ||
              extractSnippet(p.excerpt || "", q) ||
              null,
          }
        : {}),
      // Don't include full content in list response
      content: undefined,
    }));

    return ok(formatted, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Posts API Error]", error);
    return fail("获取文章列表失败", 50000, 500);
  }
}
