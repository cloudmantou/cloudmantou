import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArchivePage } from "@/components/editorial/EditorialArchivePage";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { MANTOU_ASSISTANT_ARTICLE_EN } from "@/config/editorial-blog";
import { getRequestLocale } from "@/i18n/server";
import { ENGLISH_EDITORIAL_TAGS, localizeEditorialTaxonomy, type EditorialTaxonomyItem } from "@/lib/editorial-article";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  if (locale === "en" && !ENGLISH_EDITORIAL_TAGS.some((tag) => tag.slug === slug)) {
    return { title: "Tag not found" };
  }
  const [baseCtx, tag] = await Promise.all([
    getSeoContext(locale),
    prisma.tag.findUnique({ where: { slug }, select: { name: true, slug: true } }),
  ]);
  const ctx = withEditorialSeoContext(baseCtx);
  if (!tag) return { title: locale === "en" ? "Tag not found" : "标签不存在" };
  const localized = localizeEditorialTaxonomy("tag", tag, locale);
  return buildPageMetadata(ctx, {
    title: locale === "en" ? `Posts tagged ${localized.name}` : `标签：${localized.name}`,
    description: locale === "en" ? `Articles tagged ${localized.name}.` : `带有 ${localized.name} 标签的文章。`,
    path: `/tag/${slug}`,
  });
}

export default async function TagPage({ params }: PageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  if (locale === "en" && !ENGLISH_EDITORIAL_TAGS.some((item) => item.slug === slug)) notFound();
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
  if (!tag) notFound();

  const [postRows, categoryRows, tagRows, totalPostCount] = await Promise.all([
    prisma.post.findMany({
      where: { status: { in: ["PUBLISHED", "PAID_ONLY"] }, tags: { some: { tagId: tag.id } } },
      orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
      select: {
        slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true,
        category: { select: { name: true } }, author: { select: { username: true, nickname: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, _count: { select: { posts: { where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } } } } } },
    }),
    prisma.tag.findMany({
      select: {
        slug: true,
        name: true,
        _count: {
          select: {
            posts: { where: { post: { status: { in: ["PUBLISHED", "PAID_ONLY"] } } } },
          },
        },
      },
    }),
    prisma.post.count({ where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } } }),
  ]);

  let posts: EditorialPostCardData[] = postRows;
  if (locale === "en") {
    posts = postRows.filter((post) => post.slug === MANTOU_ASSISTANT_ARTICLE_EN.slug).map((post) => ({
      ...post,
      title: MANTOU_ASSISTANT_ARTICLE_EN.title,
      excerpt: MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
      category: { name: "Product practice" },
      author: { username: "mantou", nickname: "Mantou" },
    }));
  }

  const categories: EditorialTaxonomyItem[] = categoryRows
    .filter((item) => item._count.posts > 0)
    .map((item) => localizeEditorialTaxonomy("category", { slug: item.slug, name: item.name, count: locale === "en" ? (item.slug === "product-notes" ? 1 : 0) : item._count.posts }, locale))
    .filter((item) => locale === "zh" || (item.count ?? 0) > 0);
  const tags: EditorialTaxonomyItem[] = locale === "en"
    ? ENGLISH_EDITORIAL_TAGS.map((item) => ({ ...item }))
    : tagRows
        .filter((item) => item._count.posts > 0)
        .map((item) => localizeEditorialTaxonomy("tag", { slug: item.slug, name: item.name, count: item._count.posts }, locale));
  const localizedTag = localizeEditorialTaxonomy("tag", tag, locale);

  return (
    <EditorialShell locale={locale}>
      <EditorialArchivePage
        locale={locale}
        title={locale === "en" ? `Posts tagged ${localizedTag.name}` : `标签：${localizedTag.name}`}
        description={locale === "en" ? `Field notes connected by the ${localizedTag.name} topic.` : `围绕 ${localizedTag.name} 汇总的实践文章。`}
        posts={posts}
        categories={categories}
        tags={tags}
        totalPosts={locale === "en" ? 1 : totalPostCount}
        activeTag={slug}
      />
    </EditorialShell>
  );
}
