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
  getEnglishEditorialTaxonomyArchive,
  parseEditorialArchiveParams,
  type EditorialArchiveSearchParams,
} from "@/lib/editorial-archive";

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
    if (!getEnglishEditorialTaxonomyArchive("category", slug, null)) {
      return { title: "Category not found" };
    }
    return buildPageMetadata(ctx, {
      title: "Product practice — category",
      description: "Articles filed under Product practice.",
      path: `/category/${slug}`,
    });
  }
  const category = await prisma.category.findUnique({ where: { slug }, select: { name: true, description: true, slug: true } });
  if (!category) return { title: "分类不存在" };
  const localized = localizeEditorialTaxonomy("category", category, locale);
  return buildPageMetadata(ctx, {
    title: `${localized.name} - 文章分类`,
    description: category.description || `${localized.name} 相关文章。`,
    path: `/category/${slug}`,
    translated: slug === "product-notes",
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, locale, rawSearchParams] = await Promise.all([params, getRequestLocale(), searchParams]);
  const archiveParams = parseEditorialArchiveParams(rawSearchParams);

  if (locale === "en") {
    const archive = getEnglishEditorialTaxonomyArchive(
      "category",
      slug,
      archiveParams.query,
      archiveParams.page,
      EDITORIAL_ARCHIVE_PAGE_SIZE
    );
    if (!archive) notFound();
    return (
      <EditorialShell locale={locale}>
        <EditorialArchivePage
          locale={locale}
          title="Product practice"
          description="Posts filed in Product practice."
          posts={archiveParams.queryError ? [] : archive.posts}
          categories={archive.categories}
          tags={archive.tags}
          totalPosts={archive.totalPosts}
          resultCount={archiveParams.queryError ? 0 : archive.total}
          basePath={`/category/${slug}`}
          query={archiveParams.query}
          queryError={archiveParams.queryError}
          currentPage={archive.page}
          totalPages={archive.totalPages}
          activeCategory={slug}
        />
      </EditorialShell>
    );
  }

  const category = await prisma.category.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, description: true } });
  if (!category) notFound();

  const where = {
    status: { in: [...EDITORIAL_PUBLIC_POST_STATUSES] },
    categoryId: category.id,
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
  const localizedCategory = localizeEditorialTaxonomy("category", category, locale);

  return (
    <EditorialShell locale={locale}>
      <EditorialArchivePage
        locale={locale}
        title={localizedCategory.name}
        description={category.description || `${localizedCategory.name} 相关实践记录。`}
        posts={posts}
        categories={categories}
        tags={tags}
        totalPosts={totalPostCount}
        resultCount={matchingCount}
        basePath={`/category/${slug}`}
        query={archiveParams.query}
        queryError={archiveParams.queryError}
        currentPage={currentPage}
        totalPages={Math.ceil(matchingCount / EDITORIAL_ARCHIVE_PAGE_SIZE)}
        activeCategory={slug}
      />
    </EditorialShell>
  );
}
