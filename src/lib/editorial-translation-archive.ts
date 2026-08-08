import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EDITORIAL_ARCHIVE_ORDER_BY,
  clampEditorialArchivePage,
} from "@/lib/editorial-archive";
import { localizeEditorialTaxonomy, type EditorialTaxonomyItem } from "@/lib/editorial-article";
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
  mapEnglishTranslatedPost,
} from "@/lib/editorial-translations";

type TranslationArchiveInput = {
  type: "category" | "tag";
  slug: string;
  query: string | null;
  queryError: boolean;
  page: number;
  pageSize: number;
};

export type EnglishTaxonomyArchive = {
  taxonomy: { id: string; slug: string; name: string; description?: string | null };
  posts: ReturnType<typeof mapEnglishTranslatedPost>[];
  categories: EditorialTaxonomyItem[];
  tags: EditorialTaxonomyItem[];
  totalPosts: number;
  resultCount: number;
  currentPage: number;
  totalPages: number;
};

const publishedTranslationRelation = {
  some: {
    locale: ENGLISH_POST_TRANSLATION_LOCALE,
    status: ENGLISH_POST_TRANSLATION_STATUS,
  },
} as const;

export async function loadEnglishTaxonomyArchive(
  input: TranslationArchiveInput,
): Promise<EnglishTaxonomyArchive | null> {
  const taxonomy = input.type === "category"
    ? await prisma.category.findUnique({
        where: { slug: input.slug },
        select: { id: true, slug: true, name: true, description: true },
      })
    : await prisma.tag.findUnique({
        where: { slug: input.slug },
        select: { id: true, slug: true, name: true },
      });
  if (!taxonomy) return null;

  const translationWhere = {
    locale: ENGLISH_POST_TRANSLATION_LOCALE,
    status: ENGLISH_POST_TRANSLATION_STATUS,
    ...(input.query ? {
      OR: [
        { title: { contains: input.query } },
        { excerpt: { contains: input.query } },
        { content: { contains: input.query } },
      ],
    } : {}),
  } as const;
  const where: Prisma.PostWhereInput = {
    status: "PUBLISHED",
    translations: { some: translationWhere },
    ...(input.type === "category"
      ? { categoryId: taxonomy.id }
      : { tags: { some: { tagId: taxonomy.id } } }),
  };

  const [matchingCount, categoryRows, tagRows, totalPostCount] = await Promise.all([
    input.queryError ? Promise.resolve(0) : prisma.post.count({ where }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        name: true,
        _count: {
          select: {
            posts: {
              where: {
                status: "PUBLISHED",
                translations: publishedTranslationRelation,
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
                  status: "PUBLISHED",
                  translations: publishedTranslationRelation,
                },
              },
            },
          },
        },
      },
    }),
    prisma.post.count({
      where: {
        status: "PUBLISHED",
        translations: publishedTranslationRelation,
      },
    }),
  ]);
  const currentPage = clampEditorialArchivePage(input.page, matchingCount, input.pageSize);
  const rows = input.queryError ? [] : await prisma.post.findMany({
    where,
    orderBy: EDITORIAL_ARCHIVE_ORDER_BY,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      status: true,
      isTop: true,
      category: { select: { name: true, slug: true } },
      author: { select: { username: true, nickname: true } },
      translations: {
        where: translationWhere,
        select: { title: true, excerpt: true },
        take: 1,
      },
    },
    skip: (currentPage - 1) * input.pageSize,
    take: input.pageSize,
  });

  const localizedTaxonomy = localizeEditorialTaxonomy(
    input.type,
    { slug: taxonomy.slug, name: taxonomy.name },
    "en",
  );
  return {
    taxonomy: { ...taxonomy, name: localizedTaxonomy.name },
    posts: rows.map(mapEnglishTranslatedPost),
    categories: categoryRows
      .filter((item) => item._count.posts > 0)
      .map((item) => localizeEditorialTaxonomy("category", { slug: item.slug, name: item.name, count: item._count.posts }, "en")),
    tags: tagRows
      .filter((item) => item._count.posts > 0)
      .map((item) => localizeEditorialTaxonomy("tag", { slug: item.slug, name: item.name, count: item._count.posts }, "en")),
    totalPosts: totalPostCount,
    resultCount: matchingCount,
    currentPage,
    totalPages: Math.ceil(matchingCount / input.pageSize),
  };
}
