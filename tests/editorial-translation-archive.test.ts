import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    category: { findUnique: vi.fn(), findMany: vi.fn() },
    tag: { findUnique: vi.fn(), findMany: vi.fn() },
    post: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { loadEnglishTaxonomyArchive } from "@/lib/editorial-translation-archive";
import { getPublishedEnglishTranslation, mapEnglishTranslatedPost } from "@/lib/editorial-translations";

const { prisma } = mocks;
const publishedAt = new Date("2026-03-01T00:00:00Z");
const postRow = {
  slug: "deploy-notes",
  title: "部署笔记",
  excerpt: "中文摘要",
  coverImage: null,
  publishedAt,
  status: "PUBLISHED" as const,
  isTop: false,
  category: { name: "工程", slug: "engineering" },
  author: { username: "mantou", nickname: "Mantou" },
  translations: [{ title: "Deploy notes", excerpt: "English excerpt" }],
};

describe("English taxonomy archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.category.findUnique.mockResolvedValue({ id: "c1", slug: "engineering", name: "工程", description: "d" });
    prisma.tag.findUnique.mockResolvedValue({ id: "t1", slug: "nextjs", name: "Next" });
    prisma.category.findMany.mockResolvedValue([
      { slug: "engineering", name: "工程", _count: { posts: 2 } },
      { slug: "empty", name: "空", _count: { posts: 0 } },
    ]);
    prisma.tag.findMany.mockResolvedValue([
      { slug: "nextjs", name: "Next", _count: { posts: 1 } },
      { slug: "unused", name: "未用", _count: { posts: 0 } },
    ]);
    prisma.post.count.mockImplementation(async ({ where }: { where: { categoryId?: string; tags?: unknown } }) => (where.categoryId || where.tags ? 12 : 30));
    prisma.post.findMany.mockResolvedValue([postRow]);
  });

  it("returns null for unknown taxonomies", async () => {
    prisma.category.findUnique.mockResolvedValueOnce(null);
    expect(await loadEnglishTaxonomyArchive({ type: "category", slug: "nope", query: null, queryError: false, page: 1, pageSize: 10 })).toBeNull();
    prisma.tag.findUnique.mockResolvedValueOnce(null);
    expect(await loadEnglishTaxonomyArchive({ type: "tag", slug: "nope", query: null, queryError: false, page: 1, pageSize: 10 })).toBeNull();
  });

  it("loads a category page with localized names and non-empty facets", async () => {
    const archive = await loadEnglishTaxonomyArchive({ type: "category", slug: "engineering", query: null, queryError: false, page: 9, pageSize: 10 });
    expect(archive).toMatchObject({
      taxonomy: { id: "c1", slug: "engineering", name: "Engineering", description: "d" },
      categories: [{ slug: "engineering", name: "Engineering", count: 2 }],
      tags: [{ slug: "nextjs", name: "Next.js", count: 1 }],
      totalPosts: 30,
      resultCount: 12,
      currentPage: 2,
      totalPages: 2,
    });
    expect(archive?.posts[0]).toMatchObject({ slug: "deploy-notes", title: "Deploy notes", category: { name: "Engineering" } });
    const findArgs = prisma.post.findMany.mock.calls[0][0];
    expect(findArgs).toMatchObject({ skip: 10, take: 10, where: { categoryId: "c1" } });
    expect(findArgs.where.translations.some).not.toHaveProperty("OR");
  });

  it("filters tag archives by the search query", async () => {
    await loadEnglishTaxonomyArchive({ type: "tag", slug: "nextjs", query: "deploy", queryError: false, page: 1, pageSize: 5 });
    const findArgs = prisma.post.findMany.mock.calls[0][0];
    expect(findArgs.where.tags).toEqual({ some: { tagId: "t1" } });
    expect(findArgs.where.translations.some.OR).toEqual([
      { title: { contains: "deploy" } },
      { excerpt: { contains: "deploy" } },
      { content: { contains: "deploy" } },
    ]);
  });

  it("skips matching queries when the search query is invalid", async () => {
    const archive = await loadEnglishTaxonomyArchive({ type: "tag", slug: "nextjs", query: null, queryError: true, page: 3, pageSize: 10 });
    expect(archive).toMatchObject({ posts: [], resultCount: 0, currentPage: 1, totalPages: 0, totalPosts: 30 });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.post.count).toHaveBeenCalledTimes(1);
  });
});

describe("English translation mapping", () => {
  it("requires a translation and tolerates missing category data", () => {
    expect(() => mapEnglishTranslatedPost({ ...postRow, translations: [] })).toThrow("deploy-notes");
    expect(mapEnglishTranslatedPost({ ...postRow, category: null }).category).toBeNull();
    expect(mapEnglishTranslatedPost({ ...postRow, category: { name: "杂项" } }).category).toEqual({ slug: "", name: "杂项" });
  });

  it("picks only the published translation", () => {
    const draft = { status: "DRAFT", title: "d", excerpt: null };
    const published = { status: "PUBLISHED", title: "p", excerpt: null };
    expect(getPublishedEnglishTranslation([draft, published])).toBe(published);
    expect(getPublishedEnglishTranslation([draft])).toBeNull();
  });
});
