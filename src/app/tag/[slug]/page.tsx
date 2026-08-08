import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArchivePage } from "@/components/editorial/EditorialArchivePage";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { getRequestLocale } from "@/i18n/server";
import { localizeEditorialTaxonomy, type EditorialTaxonomyItem } from "@/lib/editorial-article";
import {
  EDITORIAL_ARCHIVE_ORDER_BY,
  EDITORIAL_ARCHIVE_PAGE_SIZE,
  EDITORIAL_PUBLIC_POST_STATUSES,
  buildEditorialSearchWhere,
  clampEditorialArchivePage,
  parseEditorialArchiveParams,
  type EditorialArchiveSearchParams,
} from "@/lib/editorial-archive";
import { loadEnglishTaxonomyArchive } from "@/lib/editorial-translation-archive";
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
} from "@/lib/editorial-translations";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<EditorialArchiveSearchParams>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const baseCtx = await getSeoContext(locale);
  const ctx = withEditorialSeoContext(baseCtx);
  if (locale === "en") {
    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: {
        name: true,
        _count: {
          select: {
            posts: {
              where: {
                post: {
                  status: "PUBLISHED",
                  translations: {
                    some: {
                      locale: ENGLISH_POST_TRANSLATION_LOCALE,
                      status: ENGLISH_POST_TRANSLATION_STATUS,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!tag || tag._count.posts === 0) return { title: "Tag not found" };
    const localizedTag = localizeEditorialTaxonomy("tag", { slug, name: tag.name }, locale);
    return buildPageMetadata(ctx, {
      title: `Posts tagged ${localizedTag.name}`,
      description: `Articles tagged ${localizedTag.name}.`,
      path: `/tag/${slug}`,
    });
  }
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { name: true, slug: true } });
  if (!tag) return { title: "标签不存在" };
  const localized = localizeEditorialTaxonomy("tag", tag, locale);
  return buildPageMetadata(ctx, {
    title: `标签：${localized.name}`,
    description: `带有 ${localized.name} 标签的文章。`,
    path: `/tag/${slug}`,
    translated: ["ios", "indie-development", "product-practice"].includes(slug),
  });
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const [{ slug }, locale, rawSearchParams] = await Promise.all([params, getRequestLocale(), searchParams]);
  const archiveParams = parseEditorialArchiveParams(rawSearchParams);

  if (locale === "en") {
    const archive = await loadEnglishTaxonomyArchive({
      type: "tag",
      slug,
      query: archiveParams.query,
      queryError: Boolean(archiveParams.queryError),
      page: archiveParams.page,
      pageSize: EDITORIAL_ARCHIVE_PAGE_SIZE,
    });
    if (!archive) notFound();
    return (
      <EditorialShell locale={locale}>
        <EditorialArchivePage
          locale={locale}
          title={`Posts tagged ${archive.taxonomy.name}`}
          description={`Field notes connected by the ${archive.taxonomy.name} topic.`}
          posts={archive.posts}
          categories={archive.categories}
          tags={archive.tags}
          totalPosts={archive.totalPosts}
          resultCount={archive.resultCount}
          basePath={`/tag/${slug}`}
          query={archiveParams.query}
          queryError={archiveParams.queryError}
          currentPage={archive.currentPage}
          totalPages={archive.totalPages}
          activeTag={slug}
        />
      </EditorialShell>
    );
  }

  const tag = await prisma.tag.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
  if (!tag) notFound();

  const where = {
    status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] },
    tags: { some: { tagId: tag.id } },
    ...buildEditorialSearchWhere(archiveParams.query),
  };
  const [initialPostRows, matchingCount, categoryRows, tagRows, totalPostCount] = await Promise.all([
    archiveParams.queryError ? Promise.resolve([]) : prisma.post.findMany({
      where,
      orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
      select: {
        slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true, isTop: true,
        category: { select: { name: true } }, author: { select: { username: true, nickname: true } },
      },
      skip: (archiveParams.page - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
      take: EDITORIAL_ARCHIVE_PAGE_SIZE,
    }),
    archiveParams.queryError ? Promise.resolve(0) : prisma.post.count({ where }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: { slug: true, name: true, _count: { select: { posts: { where: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } } } } },
    }),
    prisma.tag.findMany({
      orderBy: [{ name: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        name: true,
        _count: {
          select: {
            posts: { where: { post: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } } },
          },
        },
      },
    }),
    prisma.post.count({ where: { status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] } } }),
  ]);

  const currentPage = clampEditorialArchivePage(
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
          category: { select: { name: true } }, author: { select: { username: true, nickname: true } },
        },
        skip: (currentPage - 1) * EDITORIAL_ARCHIVE_PAGE_SIZE,
        take: EDITORIAL_ARCHIVE_PAGE_SIZE,
      })
    : initialPostRows;

  const posts: EditorialPostCardData[] = postRows;

  const categories: EditorialTaxonomyItem[] = categoryRows
    .filter((item) => item._count.posts > 0)
    .map((item) => localizeEditorialTaxonomy("category", { slug: item.slug, name: item.name, count: item._count.posts }, locale));
  const tags: EditorialTaxonomyItem[] = tagRows
    .filter((item) => item._count.posts > 0)
    .map((item) => localizeEditorialTaxonomy("tag", { slug: item.slug, name: item.name, count: item._count.posts }, locale));
  const localizedTag = localizeEditorialTaxonomy("tag", tag, locale);

  return (
    <EditorialShell locale={locale}>
      <EditorialArchivePage
        locale={locale}
        title={`标签：${localizedTag.name}`}
        description={`围绕 ${localizedTag.name} 汇总的实践文章。`}
        posts={posts}
        categories={categories}
        tags={tags}
        totalPosts={totalPostCount}
        resultCount={matchingCount}
        basePath={`/tag/${slug}`}
        query={archiveParams.query}
        queryError={archiveParams.queryError}
        currentPage={currentPage}
        totalPages={Math.ceil(matchingCount / EDITORIAL_ARCHIVE_PAGE_SIZE)}
        activeTag={slug}
      />
    </EditorialShell>
  );
}
