import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArchivePage } from "@/components/editorial/EditorialArchivePage";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { getEditorialBlogCopy } from "@/config/editorial-blog";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";
import { localizeEditorialTaxonomy, type EditorialTaxonomyItem } from "@/lib/editorial-article";
import {
  EDITORIAL_ARCHIVE_ORDER_BY,
  EDITORIAL_ARCHIVE_PAGE_SIZE,
  EDITORIAL_PUBLIC_POST_STATUSES,
  buildEditorialSearchWhere,
  clampEditorialArchivePage,
  getEnglishEditorialArchive,
  parseEditorialArchiveParams,
  type EditorialArchiveSearchParams,
} from "@/lib/editorial-archive";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getEditorialBlogCopy(locale);
  const ctx = withEditorialSeoContext(await getSeoContext(locale));
  return buildPageMetadata(ctx, {
    title: copy.nav[1].label,
    description: locale === "en" ? "Field notes from real software and product work." : "来自真实开发、部署与产品实践的文章。",
    path: "/blog",
  });
}

type PageProps = { searchParams: Promise<EditorialArchiveSearchParams> };

export default async function BlogPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  const archiveParams = parseEditorialArchiveParams(await searchParams);
  let posts: EditorialPostCardData[] = [];
  let categories: EditorialTaxonomyItem[] = [];
  let tags: EditorialTaxonomyItem[] = [];
  let resultCount = 0;
  let totalPosts = 0;
  let currentPage = archiveParams.page;

  if (locale === "en") {
    const archive = getEnglishEditorialArchive(
      archiveParams.query,
      archiveParams.page,
      EDITORIAL_ARCHIVE_PAGE_SIZE
    );
    posts = archiveParams.queryError ? [] : archive.posts;
    categories = archive.categories;
    tags = archive.tags;
    resultCount = archiveParams.queryError ? 0 : archive.total;
    totalPosts = archive.totalPosts;
    currentPage = archive.page;
  } else {
    try {
      const where = {
        status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] },
        ...buildEditorialSearchWhere(archiveParams.query),
      };
      const [initialPostRows, matchingCount, categoryRows, tagRows, allPostCount] = await Promise.all([
        archiveParams.queryError ? Promise.resolve([]) : prisma.post.findMany({
          where,
          orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
          select: {
            slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true,
            category: { select: { name: true } },
            author: { select: { username: true, nickname: true } },
          },
          skip: (archiveParams.page - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
          take: EDITORIAL_ARCHIVE_PAGE_SIZE,
        }),
        archiveParams.queryError ? Promise.resolve(0) : prisma.post.count({ where }),
        prisma.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
          select: {
            slug: true, name: true,
            _count: { select: { posts: { where: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } } } },
          },
        }),
        prisma.tag.findMany({
          orderBy: [{ name: "asc" }, { slug: "asc" }],
          select: {
            slug: true, name: true,
            _count: { select: { posts: { where: { post: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } } } } },
          },
        }),
        prisma.post.count({ where: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } }),
      ]);
      currentPage = clampEditorialArchivePage(
        archiveParams.page,
        matchingCount,
        EDITORIAL_ARCHIVE_PAGE_SIZE
      );
      const postRows = !archiveParams.queryError && currentPage !== archiveParams.page
        ? await prisma.post.findMany({
            where,
            orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
            select: {
              slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true,
              category: { select: { name: true } },
              author: { select: { username: true, nickname: true } },
            },
            skip: (currentPage - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
            take: EDITORIAL_ARCHIVE_PAGE_SIZE,
          })
        : initialPostRows;
      posts = postRows;
      resultCount = matchingCount;
      totalPosts = allPostCount;
      categories = categoryRows.filter((item) => item._count.posts > 0).map((item) => ({ slug: item.slug, name: item.name, count: item._count.posts }));
      tags = tagRows.filter((item) => item._count.posts > 0).map((item) => ({ slug: item.slug, name: item.name, count: item._count.posts }));
    } catch {
      posts = [];
    }
  }

  categories = categories.map((item) => localizeEditorialTaxonomy("category", item, locale));
  tags = tags.map((item) => localizeEditorialTaxonomy("tag", item, locale));

  return (
    <EditorialShell locale={locale}>
      <EditorialArchivePage
        locale={locale}
        title={locale === "en" ? "Article archive" : "文章归档"}
        description={locale === "en" ? "Explore verified notes by time, category, and topic." : "按时间、分类和主题，探索真实项目与实践记录。"}
        posts={posts}
        categories={categories}
        tags={tags}
        totalPosts={totalPosts}
        resultCount={resultCount}
        basePath="/blog"
        query={archiveParams.query}
        queryError={archiveParams.queryError}
        currentPage={currentPage}
        totalPages={Math.ceil(resultCount / EDITORIAL_ARCHIVE_PAGE_SIZE)}
      />
    </EditorialShell>
  );
}
