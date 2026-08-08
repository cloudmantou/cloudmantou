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
  parseEditorialArchiveParams,
  getEnglishEditorialArchive,
  type EditorialArchiveSearchParams,
} from "@/lib/editorial-archive";
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
  mapEnglishTranslatedPost,
} from "@/lib/editorial-translations";
import { MANTOU_ASSISTANT_ARTICLE_EN } from "@/config/editorial-blog";
import { canUseStaticEnglishMantouFallback } from "@/lib/editorial-static-fallback";

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
    try {
      const translationWhere = {
        locale: ENGLISH_POST_TRANSLATION_LOCALE,
        status: ENGLISH_POST_TRANSLATION_STATUS,
        ...(archiveParams.query ? {
          OR: [
            { title: { contains: archiveParams.query } },
            { excerpt: { contains: archiveParams.query } },
            { content: { contains: archiveParams.query } },
          ],
        } : {}),
      };
      const publicEnglishWhere = {
        status: "PUBLISHED" as const,
        translations: { some: translationWhere },
      };
      const allPublishedTranslation = {
        some: {
          locale: ENGLISH_POST_TRANSLATION_LOCALE,
          status: ENGLISH_POST_TRANSLATION_STATUS,
        },
      };
      const [initialRows, matchingCount, categoryRows, tagRows, allPostCount] = await Promise.all([
        archiveParams.queryError ? Promise.resolve([]) : prisma.post.findMany({
          where: publicEnglishWhere,
          orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
          select: {
            slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true, isTop: true,
            category: { select: { name: true, slug: true } },
            author: { select: { username: true, nickname: true } },
            translations: {
              where: translationWhere,
              select: { title: true, excerpt: true },
              take: 1,
            },
          },
          skip: (archiveParams.page - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
          take: EDITORIAL_ARCHIVE_PAGE_SIZE,
        }),
        archiveParams.queryError ? Promise.resolve(0) : prisma.post.count({ where: publicEnglishWhere }),
        prisma.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
          select: {
            slug: true,
            name: true,
            _count: {
              select: {
                posts: {
                  where: {
                    status: "PUBLISHED" as const,
                    translations: allPublishedTranslation,
                  },
                },
              },
            },
          },
        }),
        prisma.tag.findMany({
          orderBy: [{ name: "asc" }, { slug: "asc" }],
          select: {
            slug: true,
            name: true,
            _count: {
              select: {
                posts: {
                  where: {
                    post: {
                      status: "PUBLISHED" as const,
                      translations: allPublishedTranslation,
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.post.count({
          where: {
            status: "PUBLISHED" as const,
            translations: allPublishedTranslation,
          },
        }),
      ]);
      currentPage = clampEditorialArchivePage(
        archiveParams.page,
        matchingCount,
        EDITORIAL_ARCHIVE_PAGE_SIZE,
      );
      const rows = !archiveParams.queryError && currentPage !== archiveParams.page
        ? await prisma.post.findMany({
            where: publicEnglishWhere,
            orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
            select: {
              slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true, isTop: true,
              category: { select: { name: true, slug: true } },
              author: { select: { username: true, nickname: true } },
              translations: {
                where: translationWhere,
                select: { title: true, excerpt: true },
                take: 1,
              },
            },
            skip: (currentPage - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
            take: EDITORIAL_ARCHIVE_PAGE_SIZE,
          })
        : initialRows;
      posts = rows.map(mapEnglishTranslatedPost);
      resultCount = matchingCount;
      totalPosts = allPostCount;
      categories = categoryRows.filter((item) => item._count.posts > 0).map((item) => ({ slug: item.slug, name: item.name, count: item._count.posts }));
      tags = tagRows.filter((item) => item._count.posts > 0).map((item) => ({ slug: item.slug, name: item.name, count: item._count.posts }));

      if (allPostCount === 0) {
        const fallbackSource = await prisma.post.findUnique({
          where: { slug: MANTOU_ASSISTANT_ARTICLE_EN.slug },
          select: {
            title: true,
            excerpt: true,
            content: true,
            status: true,
            translations: {
              where: { locale: ENGLISH_POST_TRANSLATION_LOCALE },
              select: { status: true },
            },
          },
        });
        if (canUseStaticEnglishMantouFallback(fallbackSource)) {
          const fallback = getEnglishEditorialArchive(
            archiveParams.queryError ? "__invalid_search__" : archiveParams.query,
            archiveParams.page,
          );
          posts = fallback.posts;
          categories = fallback.categories;
          tags = fallback.tags;
          resultCount = archiveParams.queryError ? 0 : fallback.total;
          totalPosts = fallback.totalPosts;
          currentPage = fallback.page;
        }
      }
    } catch (error) {
      console.error("[Editorial Archive] Unable to load English translations", error);
      posts = [];
    }
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
            slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true, isTop: true,
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
              slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true, isTop: true,
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
