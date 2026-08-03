import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  post: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  EDITORIAL_ARCHIVE_PAGE_SIZE,
  EDITORIAL_SEARCH_MAX_LENGTH,
  buildEditorialArchiveHref,
  buildEditorialSearchWhere,
  clampEditorialArchivePage,
  getEnglishEditorialArchive,
  getEnglishEditorialTaxonomyArchive,
  parseEditorialArchiveParams,
} from "@/lib/editorial-archive";
import { GET } from "@/app/api/posts/route";

describe("editorial archive query parsing", () => {
  it("distinguishes an omitted query from an empty submitted query", () => {
    expect(parseEditorialArchiveParams({})).toMatchObject({
      query: null,
      queryError: null,
      page: 1,
    });
    expect(parseEditorialArchiveParams({ q: "   " })).toMatchObject({
      query: null,
      queryError: "empty",
      page: 1,
    });
  });

  it("rejects overlong queries and normalizes invalid pages", () => {
    expect(
      parseEditorialArchiveParams({ q: "x".repeat(EDITORIAL_SEARCH_MAX_LENGTH + 1), page: "2" })
    ).toMatchObject({ query: null, queryError: "too_long", page: 2 });
    expect(parseEditorialArchiveParams({ page: "2anything" }).page).toBe(1);
    expect(parseEditorialArchiveParams({ page: "-4" }).page).toBe(1);
  });

  it("keeps the query while changing pages or taxonomy paths", () => {
    expect(
      buildEditorialArchiveHref("/en/category/product-notes", { query: "ios tools", page: 3 })
    ).toBe("/en/category/product-notes?q=ios+tools&page=3");
    expect(buildEditorialArchiveHref("/blog", { query: "ios tools", page: 1 })).toBe(
      "/blog?q=ios+tools"
    );
  });

  it("clamps out-of-range pages after the result count is known", () => {
    expect(clampEditorialArchivePage(999, 11, 10)).toBe(2);
    expect(clampEditorialArchivePage(999, 0, 10)).toBe(1);
    expect(getEnglishEditorialArchive(null, 999).page).toBe(1);
    expect(getEnglishEditorialArchive(null, 999).posts).toHaveLength(1);
  });

  it("searches paid articles by public metadata but only searches public article bodies", () => {
    expect(buildEditorialSearchWhere("private phrase")).toEqual({
      OR: [
        { title: { contains: "private phrase" } },
        { excerpt: { contains: "private phrase" } },
        {
          status: "PUBLISHED",
          content: { contains: "private phrase" },
        },
      ],
    });
  });
});

describe("English static editorial taxonomy archive", () => {
  it("resolves the Mantou category and every published English tag without a database", () => {
    const category = getEnglishEditorialTaxonomyArchive("category", "product-notes", null);
    const tag = getEnglishEditorialTaxonomyArchive("tag", "ios", null);

    expect(category?.posts.map((post) => post.slug)).toEqual(["mantou-assistant"]);
    expect(tag?.posts.map((post) => post.slug)).toEqual(["mantou-assistant"]);
    expect(getEnglishEditorialTaxonomyArchive("category", "devops", null)).toBeNull();
  });

  it("searches English static content and returns an empty result for a miss", () => {
    expect(
      getEnglishEditorialTaxonomyArchive("tag", "ios", "virtual location")?.posts
    ).toHaveLength(1);
    expect(getEnglishEditorialTaxonomyArchive("tag", "ios", "definitely absent")?.posts).toEqual([]);
  });
});

describe("GET /api/posts public search contract", () => {
  beforeEach(() => {
    prismaMock.post.findMany.mockReset();
    prismaMock.post.count.mockReset();
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: "post-1",
        title: "Public title",
        slug: "public-title",
        excerpt: "Public excerpt mentioning iOS.",
        content: "A public body mentioning iOS.",
        coverImage: null,
        publishedAt: new Date("2026-08-01T00:00:00Z"),
        viewCount: 12,
        isTop: false,
        status: "PUBLISHED",
        author: { username: "mantou", nickname: "Mantou" },
        category: { name: "Product", slug: "product" },
        tags: [{ tag: { id: "tag-1", name: "iOS", slug: "ios", color: "#fff" } }],
        authorId: "must-not-leak",
        categoryId: "must-not-leak",
        paidContent: { content: "must-not-leak" },
      },
    ]);
    prismaMock.post.count.mockResolvedValue(6);
  });

  it("rejects empty and overlong submitted queries before touching the database", async () => {
    for (const q of ["", " ", "x".repeat(EDITORIAL_SEARCH_MAX_LENGTH + 1)]) {
      const response = await GET(new NextRequest(`http://localhost/api/posts?q=${encodeURIComponent(q)}`));
      expect(response.status).toBe(400);
    }
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
  });

  it("uses stable public-only pagination and never serializes internal post fields", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/posts?q=iOS&page=2&pageSize=5")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
        select: expect.objectContaining({
          id: true,
          title: true,
          slug: true,
        }),
      })
    );
    expect(prismaMock.post.findMany.mock.calls[0][0].select).not.toHaveProperty("content");
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });
    expect(body.data[0]).toMatchObject({
      id: "post-1",
      slug: "public-title",
      premium: false,
      matchedContent: expect.stringContaining("iOS"),
    });
    expect(body.data[0]).not.toHaveProperty("content");
    expect(body.data[0]).not.toHaveProperty("status");
    expect(body.data[0]).not.toHaveProperty("authorId");
    expect(body.data[0]).not.toHaveProperty("categoryId");
    expect(body.data[0]).not.toHaveProperty("paidContent");
  });

  it("uses the archive page size as the default API page size", async () => {
    await GET(new NextRequest("http://localhost/api/posts"));
    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: EDITORIAL_ARCHIVE_PAGE_SIZE })
    );
  });

  it("returns the last valid API page when the requested page is out of range", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/posts?page=999&pageSize=5")
    );
    const body = await response.json();

    expect(prismaMock.post.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 5, take: 5 })
    );
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });
  });

  it("serves the English static article search without querying the Chinese database", async () => {
    prismaMock.post.findMany.mockClear();
    prismaMock.post.count.mockClear();
    const response = await GET(
      new NextRequest("http://localhost/api/posts?q=virtual%20location&locale=en&pageSize=6")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({ id: "static:mantou-assistant", slug: "mantou-assistant" }),
    ]);
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
    expect(prismaMock.post.count).not.toHaveBeenCalled();
  });
});
