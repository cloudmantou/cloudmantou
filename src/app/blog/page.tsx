import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArchivePage } from "@/components/editorial/EditorialArchivePage";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { MANTOU_ASSISTANT_ARTICLE_EN, getEditorialBlogCopy } from "@/config/editorial-blog";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";
import { ENGLISH_EDITORIAL_TAGS, localizeEditorialTaxonomy, type EditorialTaxonomyItem } from "@/lib/editorial-article";

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

function englishArchive() {
  const posts: EditorialPostCardData[] = [{
    slug: MANTOU_ASSISTANT_ARTICLE_EN.slug,
    title: MANTOU_ASSISTANT_ARTICLE_EN.title,
    excerpt: MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
    coverImage: MANTOU_ASSISTANT_ARTICLE_EN.coverImage,
    publishedAt: new Date(MANTOU_ASSISTANT_ARTICLE_EN.publishedAt),
    status: "PUBLISHED",
    category: { name: "Product practice" },
    author: { username: "mantou", nickname: "Mantou" },
  }];
  const categories: EditorialTaxonomyItem[] = [{ slug: "product-notes", name: "Product practice", count: 1 }];
  const tags: EditorialTaxonomyItem[] = ENGLISH_EDITORIAL_TAGS.map((tag) => ({ ...tag }));
  return { posts, categories, tags };
}

export default async function BlogPage() {
  const locale = await getRequestLocale();
  let posts: EditorialPostCardData[] = [];
  let categories: EditorialTaxonomyItem[] = [];
  let tags: EditorialTaxonomyItem[] = [];

  if (locale === "en") {
    ({ posts, categories, tags } = englishArchive());
  } else {
    try {
      const [postRows, categoryRows, tagRows] = await Promise.all([
        prisma.post.findMany({
          where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
          orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
          select: {
            slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, status: true,
            category: { select: { name: true } },
            author: { select: { username: true, nickname: true } },
          },
        }),
        prisma.category.findMany({
          orderBy: { sortOrder: "asc" },
          select: {
            slug: true, name: true,
            _count: { select: { posts: { where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } } } } },
          },
        }),
        prisma.tag.findMany({
          select: {
            slug: true, name: true,
            _count: { select: { posts: { where: { post: { status: { in: ["PUBLISHED", "PAID_ONLY"] } } } } } },
          },
        }),
      ]);
      posts = postRows;
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
      />
    </EditorialShell>
  );
}
