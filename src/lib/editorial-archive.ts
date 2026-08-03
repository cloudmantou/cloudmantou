import type { Prisma } from "@prisma/client";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import {
  MANTOU_ASSISTANT_ARTICLE_EN,
} from "@/config/editorial-blog";
import {
  ENGLISH_EDITORIAL_TAGS,
  type EditorialTaxonomyItem,
} from "@/lib/editorial-article";

export const EDITORIAL_ARCHIVE_PAGE_SIZE = 10;
export const EDITORIAL_SEARCH_MAX_LENGTH = 80;
export const EDITORIAL_PUBLIC_POST_STATUSES = ["PUBLISHED", "PAID_ONLY"] as const;

export const EDITORIAL_ARCHIVE_ORDER_BY = [
  { isTop: "desc" },
  { publishedAt: "desc" },
  { id: "desc" },
] satisfies Prisma.PostOrderByWithRelationInput[];

type SearchParamValue = string | string[] | undefined;
export type EditorialArchiveSearchParams = Record<string, SearchParamValue>;
export type EditorialArchiveQueryError = "empty" | "too_long" | null;

export type ParsedEditorialArchiveParams = {
  query: string | null;
  queryError: EditorialArchiveQueryError;
  page: number;
};

export type EnglishEditorialArchive = {
  posts: EditorialPostCardData[];
  categories: EditorialTaxonomyItem[];
  tags: EditorialTaxonomyItem[];
  total: number;
  totalPosts: number;
  page: number;
  totalPages: number;
};

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeEditorialQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseEditorialArchiveParams(
  params: EditorialArchiveSearchParams
): ParsedEditorialArchiveParams {
  const rawQuery = firstParam(params.q);
  const normalizedQuery = rawQuery === undefined ? null : normalizeEditorialQuery(rawQuery);
  let queryError: EditorialArchiveQueryError = null;
  let query: string | null = normalizedQuery;

  if (rawQuery !== undefined && normalizedQuery === "") {
    queryError = "empty";
    query = null;
  } else if (
    normalizedQuery !== null &&
    normalizedQuery.length > EDITORIAL_SEARCH_MAX_LENGTH
  ) {
    queryError = "too_long";
    query = null;
  }

  const rawPage = firstParam(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { query, queryError, page };
}

export function buildEditorialArchiveHref(
  pathname: string,
  input: { query?: string | null; page?: number }
): string {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function buildEditorialSearchWhere(query: string | null): Prisma.PostWhereInput {
  if (!query) return {};
  return {
    OR: [
      { title: { contains: query } },
      { excerpt: { contains: query } },
      { status: "PUBLISHED", content: { contains: query } },
    ],
  };
}

export function clampEditorialArchivePage(
  requestedPage: number,
  total: number,
  pageSize = EDITORIAL_ARCHIVE_PAGE_SIZE
): number {
  const normalizedPageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? pageSize
    : EDITORIAL_ARCHIVE_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / normalizedPageSize));
  const normalizedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  return Math.min(normalizedPage, totalPages);
}

function getEnglishMantouPost(): EditorialPostCardData {
  return {
    slug: MANTOU_ASSISTANT_ARTICLE_EN.slug,
    title: MANTOU_ASSISTANT_ARTICLE_EN.title,
    excerpt: MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
    coverImage: MANTOU_ASSISTANT_ARTICLE_EN.coverImage,
    publishedAt: new Date(MANTOU_ASSISTANT_ARTICLE_EN.publishedAt),
    status: "PUBLISHED",
    category: { name: "Product practice" },
    author: { username: "mantou", nickname: "Mantou" },
  };
}

function englishMantouMatches(query: string | null): boolean {
  if (!query) return true;
  const haystack = [
    MANTOU_ASSISTANT_ARTICLE_EN.title,
    MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
    MANTOU_ASSISTANT_ARTICLE_EN.content,
  ].join("\n").toLocaleLowerCase("en");
  return haystack.includes(query.toLocaleLowerCase("en"));
}

export function getEnglishEditorialArchive(
  query: string | null,
  page = 1,
  pageSize = EDITORIAL_ARCHIVE_PAGE_SIZE
): EnglishEditorialArchive {
  const allPosts = englishMantouMatches(query) ? [getEnglishMantouPost()] : [];
  const currentPage = clampEditorialArchivePage(page, allPosts.length, pageSize);
  const totalPages = Math.max(1, Math.ceil(allPosts.length / pageSize));
  const start = (currentPage - 1) * pageSize;
  return {
    posts: allPosts.slice(start, start + pageSize),
    categories: [{ slug: "product-notes", name: "Product practice", count: 1 }],
    tags: ENGLISH_EDITORIAL_TAGS.map((tag) => ({ ...tag })),
    total: allPosts.length,
    totalPosts: 1,
    page: currentPage,
    totalPages,
  };
}

export function getEnglishEditorialTaxonomyArchive(
  type: "category" | "tag",
  slug: string,
  query: string | null,
  page = 1,
  pageSize = EDITORIAL_ARCHIVE_PAGE_SIZE
): EnglishEditorialArchive | null {
  const exists = type === "category"
    ? slug === "product-notes"
    : ENGLISH_EDITORIAL_TAGS.some((tag) => tag.slug === slug);
  return exists ? getEnglishEditorialArchive(query, page, pageSize) : null;
}
