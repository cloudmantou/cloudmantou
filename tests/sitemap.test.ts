import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
  storeApp: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  tag: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/seo", () => ({
  getSeoContext: vi.fn().mockResolvedValue({ url: "https://cloudmantoua.top" }),
}));
vi.mock("@/config/site", () => ({ isOfficialSite: true }));

describe("official sitemap", () => {
  beforeEach(() => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.storeApp.findMany.mockResolvedValue([
      { slug: "xiangse", updatedAt: new Date("2026-07-01T00:00:00Z") },
    ]);
    prismaMock.category.findMany.mockResolvedValue([{ slug: "tools" }]);
    prismaMock.tag.findMany.mockResolvedValue([{ slug: "ios" }]);
  });

  it("includes both localized store detail URLs", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const rows = await sitemap();
    const urls = rows.map((row) => row.url);

    expect(urls).toContain("https://cloudmantoua.top/store/xiangse");
    expect(urls).toContain("https://cloudmantoua.top/en/store/xiangse");
  });

  it("does not mark static routes as modified on every request", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const rows = await sitemap();
    const staticPage = rows.find((row) => row.url === "https://cloudmantoua.top/features");
    const categoryPage = rows.find((row) => row.url.endsWith("/category/tools"));

    expect(staticPage?.lastModified).toBeUndefined();
    expect(categoryPage?.lastModified).toBeUndefined();
  });
});
