import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import {
  EDITORIAL_ARCHIVE_ORDER_BY,
  EDITORIAL_ARCHIVE_PAGE_SIZE,
  EDITORIAL_PUBLIC_POST_STATUSES,
  EDITORIAL_SEARCH_MAX_LENGTH,
  buildEditorialSearchWhere,
  clampEditorialArchivePage,
  getEnglishEditorialArchive,
  normalizeEditorialQuery,
  parseEditorialArchiveParams,
} from "@/lib/editorial-archive";

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
    const rawQuery = searchParams.get("q");
    const parsed = parseEditorialArchiveParams({
      q: rawQuery === null ? undefined : rawQuery,
      page: searchParams.get("page") ?? undefined,
    });
    if (parsed.queryError === "empty") {
      return fail("搜索关键词不能为空", 40001, 400);
    }
    if (parsed.queryError === "too_long") {
      return fail(`搜索关键词不能超过 ${EDITORIAL_SEARCH_MAX_LENGTH} 个字符`, 40002, 400);
    }

    const rawPageSize = searchParams.get("pageSize");
    const parsedPageSize = rawPageSize && /^\d+$/.test(rawPageSize)
      ? Number(rawPageSize)
      : EDITORIAL_ARCHIVE_PAGE_SIZE;
    const pageSize = Math.min(50, Math.max(1, parsedPageSize));
    const categoryId = normalizeEditorialQuery(searchParams.get("categoryId") || "") || undefined;
    const tag = normalizeEditorialQuery(searchParams.get("tag") || "") || undefined;
    if ((categoryId?.length ?? 0) > 100 || (tag?.length ?? 0) > 100) {
      return fail("筛选参数过长", 40003, 400);
    }

    if (searchParams.get("locale") === "en") {
      const archive = getEnglishEditorialArchive(parsed.query, parsed.page, pageSize);
      const formatted = archive.posts.map((post) => ({
        id: `static:${post.slug}`,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        publishedAt: post.publishedAt,
        viewCount: 0,
        isTop: false,
        author: post.author,
        category: post.category,
        tags: [],
        premium: post.status === "PAID_ONLY",
        matchedContent: parsed.query ? post.excerpt : null,
      }));
      return ok(formatted, {
        page: archive.page,
        pageSize,
        total: archive.total,
        totalPages: archive.totalPages,
      });
    }

    const where = {
      status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] },
      ...(categoryId && { categoryId }),
      ...(tag && {
        tags: { some: { tag: { slug: tag } } },
      }),
      ...buildEditorialSearchWhere(parsed.query),
    };

    const [initialPosts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          viewCount: true,
          isTop: true,
          status: true,
          author: { select: { username: true, nickname: true } },
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
        },
        orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
        skip: (parsed.page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    const currentPage = clampEditorialArchivePage(parsed.page, total, pageSize);
    const posts = currentPage === parsed.page
      ? initialPosts
      : await prisma.post.findMany({
          where,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            publishedAt: true,
            viewCount: true,
            isTop: true,
            status: true,
            author: { select: { username: true, nickname: true } },
            category: { select: { name: true, slug: true } },
            tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
          },
          orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

    const formatted = posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      publishedAt: post.publishedAt,
      viewCount: post.viewCount,
      isTop: post.isTop,
      author: post.author,
      category: post.category,
      tags: post.tags.map((postTag) => postTag.tag),
      premium: post.status === "PAID_ONLY",
      matchedContent: parsed.query
        ? extractSnippet(post.excerpt || "", parsed.query)
        : null,
    }));

    return ok(formatted, {
      page: currentPage,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Posts API Error]", error);
    return fail("获取文章列表失败", 50000, 500);
  }
}
