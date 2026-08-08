import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn(), findUnique: vi.fn() },
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
    prismaMock.post.findUnique.mockResolvedValue(null);
    prismaMock.storeApp.findMany.mockResolvedValue([
      { slug: "xiangse", updatedAt: new Date("2026-07-01T00:00:00Z") },
    ]);
    prismaMock.category.findMany.mockResolvedValue([{ slug: "tools", _count: { posts: 0 } }]);
    prismaMock.tag.findMany.mockResolvedValue([{ slug: "ios", _count: { posts: 0 } }]);
  });

  it("keeps retired store routes out of the public sitemap", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const rows = await sitemap();
    const urls = rows.map((row) => row.url);

    expect(urls.some((url) => url.includes("/store"))).toBe(false);
    expect(prismaMock.storeApp.findMany).not.toHaveBeenCalled();
  });

  it("does not mark static routes as modified on every request", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const rows = await sitemap();
    const staticPage = rows.find((row) => row.url === "https://cloudmantoua.top/features");
    const categoryPage = rows.find((row) => row.url.endsWith("/category/tools"));

    expect(staticPage?.lastModified).toBeUndefined();
    expect(categoryPage?.lastModified).toBeUndefined();
  });

  it("includes localized editorial public-information pages", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((row) => row.url);

    for (const path of ["about", "privacy", "disclaimer", "contact"]) {
      expect(urls).toContain(`https://cloudmantoua.top/${path}`);
      expect(urls).toContain(`https://cloudmantoua.top/en/${path}`);
    }
    expect(urls.some((url) => /\/(?:en\/)?(?:login|register)$/.test(url))).toBe(false);
  });

  it("keeps the bundled English Mantou article discoverable before managed translation migration", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((row) => row.url);

    expect(urls).toContain("https://cloudmantoua.top/en/post/mantou-assistant");
  });
});
