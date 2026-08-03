import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locale: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  prisma: {
    post: { findMany: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    tag: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/i18n/server", () => ({ getRequestLocale: mocks.locale }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound,
}));

import BlogPage from "@/app/blog/page";
import CategoryPage from "@/app/category/[slug]/page";
import TagPage from "@/app/tag/[slug]/page";

function archiveProps(result: Awaited<ReturnType<typeof BlogPage>>) {
  return (result as any).props.children.props;
}

describe("editorial archive SSR pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.category.findMany.mockResolvedValue([]);
    mocks.prisma.tag.findMany.mockResolvedValue([]);
    mocks.prisma.post.findMany.mockResolvedValue([]);
    mocks.prisma.post.count.mockResolvedValue(0);
  });

  it("runs a shareable Chinese search with stable pagination", async () => {
    mocks.locale.mockResolvedValue("zh");
    mocks.prisma.post.findMany.mockResolvedValue([
      {
        slug: "matched",
        title: "iOS 实践",
        excerpt: "搜索结果",
        coverImage: null,
        publishedAt: new Date("2026-08-01T00:00:00Z"),
        status: "PUBLISHED",
        category: { name: "产品实践" },
        author: { username: "mantou", nickname: "馒头" },
      },
    ]);
    mocks.prisma.post.count.mockResolvedValueOnce(21).mockResolvedValueOnce(30);

    const result = await BlogPage({
      searchParams: Promise.resolve({ q: " iOS  实践 ", page: "2" }),
    });
    const props = archiveProps(result);

    expect(mocks.prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PUBLISHED", "PAID_ONLY"] },
          OR: expect.arrayContaining([{ title: { contains: "iOS 实践" } }]),
        }),
        skip: 10,
        take: 10,
        orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      })
    );
    expect(props).toMatchObject({
      query: "iOS 实践",
      currentPage: 2,
      resultCount: 21,
      totalPosts: 30,
      totalPages: 3,
    });
    expect(mocks.prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] })
    );
    expect(mocks.prisma.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ name: "asc" }, { slug: "asc" }] })
    );
  });

  it("clamps an out-of-range Chinese page and reloads the last valid page", async () => {
    mocks.locale.mockResolvedValue("zh");
    const lastPost = {
      slug: "last-page",
      title: "最后一页",
      excerpt: null,
      coverImage: null,
      publishedAt: new Date("2025-01-01T00:00:00Z"),
      status: "PUBLISHED",
      category: null,
      author: { username: "mantou", nickname: "馒头" },
    };
    mocks.prisma.post.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([lastPost]);
    mocks.prisma.post.count.mockResolvedValueOnce(11).mockResolvedValueOnce(30);

    const result = await BlogPage({
      searchParams: Promise.resolve({ q: "iOS", page: "999" }),
    });
    const props = archiveProps(result);

    expect(mocks.prisma.post.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 10, take: 10 })
    );
    expect(props).toMatchObject({
      currentPage: 2,
      totalPages: 2,
      posts: [lastPost],
    });
  });

  it("does not run a content query for an empty submitted search", async () => {
    mocks.locale.mockResolvedValue("zh");

    const result = await BlogPage({ searchParams: Promise.resolve({ q: " " }) });
    const props = archiveProps(result);

    expect(mocks.prisma.post.findMany).not.toHaveBeenCalled();
    expect(props).toMatchObject({ queryError: "empty", posts: [], resultCount: 0 });
  });

  it("serves English category and tag routes from static content without Prisma", async () => {
    mocks.locale.mockResolvedValue("en");

    const categoryResult = await CategoryPage({
      params: Promise.resolve({ slug: "product-notes" }),
      searchParams: Promise.resolve({}),
    });
    const tagResult = await TagPage({
      params: Promise.resolve({ slug: "ios" }),
      searchParams: Promise.resolve({ q: "virtual location" }),
    });
    const categoryProps = (categoryResult as any).props.children.props;
    const tagProps = (tagResult as any).props.children.props;

    expect(mocks.prisma.category.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.tag.findUnique).not.toHaveBeenCalled();
    expect(categoryProps.posts[0].slug).toBe("mantou-assistant");
    expect(tagProps.posts[0].slug).toBe("mantou-assistant");
    expect(tagProps.query).toBe("virtual location");
  });
});
