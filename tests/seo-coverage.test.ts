import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/site-settings", () => ({
  getSiteSettings: getSiteSettingsMock,
}));

import {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
  buildBlogJsonLd,
  buildBlogPostingJsonLd,
  buildPageMetadata,
  buildRootMetadata,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  getSeoContext,
  resolveSiteUrl,
  type SeoContext,
} from "@/lib/seo";

const ctx: SeoContext = {
  name: "Example",
  subtitle: "Example subtitle",
  description: "Example description",
  url: "https://example.test",
  locale: "zh",
};

describe("SEO production exports", () => {
  beforeEach(() => {
    getSiteSettingsMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves settings, environment, and default site URLs without trailing slashes", () => {
    expect(resolveSiteUrl(" https://settings.example/ ")).toBe("https://settings.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://public.example/");
    expect(resolveSiteUrl()).toBe("https://public.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "https://server.example/");
    expect(resolveSiteUrl()).toBe("https://server.example");
    vi.stubEnv("SITE_URL", "");
    expect(resolveSiteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it("locks official branding while preserving the configured canonical URL", async () => {
    getSiteSettingsMock.mockResolvedValueOnce({
      siteName: "  Configured Name  ",
      siteSubtitle: " Configured subtitle ",
      siteDescription: " Configured description ",
      siteUrl: "https://configured.example/",
    });
    await expect(getSeoContext()).resolves.toEqual({
      name: BRAND_NAME,
      subtitle: DEFAULT_SITE_SUBTITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      url: "https://configured.example",
      locale: "zh",
    });

    getSiteSettingsMock.mockResolvedValueOnce({
      siteName: " ",
      siteSubtitle: " ",
      siteDescription: " ",
      siteUrl: "",
    });
    await expect(getSeoContext()).resolves.toEqual({
      name: BRAND_NAME,
      subtitle: DEFAULT_SITE_SUBTITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      url: DEFAULT_SITE_URL,
      locale: "zh",
    });
  });

  it("uses localized official branding for English requests", async () => {
    getSiteSettingsMock.mockResolvedValueOnce({ siteUrl: "https://configured.example/" });
    await expect(getSeoContext("en")).resolves.toMatchObject({
      name: "Mantou Assistant",
      subtitle: "A free essential toolkit for iOS devices",
      locale: "en",
    });
  });

  it("builds canonical root metadata for search and social crawlers", () => {
    const metadata = buildRootMetadata(ctx);

    expect(metadata.metadataBase).toEqual(new URL(ctx.url));
    expect(metadata).toMatchObject({
      title: { default: "Example — Example subtitle", template: "%s | Example" },
      description: ctx.description,
      alternates: { canonical: ctx.url },
      openGraph: { type: "website", url: ctx.url, siteName: ctx.name },
      twitter: { card: "summary_large_image" },
      robots: { index: true, follow: true },
    });
    expect(metadata.keywords).toContain("馒头助手");
    expect(metadata.alternates).toMatchObject({
      canonical: "https://example.test",
      languages: {
        "zh-CN": "https://example.test",
        "en-US": "https://example.test/en",
        "x-default": "https://example.test",
      },
    });
  });

  it("builds a separate English canonical with reciprocal language alternates", () => {
    const englishContext: SeoContext = { ...ctx, locale: "en" };
    expect(
      buildPageMetadata(englishContext, {
        title: "Features",
        path: "/features",
      })
    ).toMatchObject({
      alternates: {
        canonical: "https://example.test/en/features",
        languages: {
          "zh-CN": "https://example.test/features",
          "en-US": "https://example.test/en/features",
          "x-default": "https://example.test/features",
        },
      },
      openGraph: { locale: "en_US", url: "https://example.test/en/features" },
    });
  });

  it("builds page metadata with and without optional canonical and image values", () => {
    expect(
      buildPageMetadata(ctx, {
        title: "Article",
        description: "Article description",
        path: "/post/article",
        type: "article",
        image: "https://example.test/cover.webp",
      })
    ).toMatchObject({
      title: "Article",
      description: "Article description",
      alternates: { canonical: "https://example.test/post/article" },
      openGraph: {
        type: "article",
        url: "https://example.test/post/article",
        images: [{ url: "https://example.test/cover.webp" }],
      },
      twitter: { card: "summary_large_image" },
    });

    expect(buildPageMetadata(ctx, { title: "Plain" })).toMatchObject({
      title: "Plain",
      description: ctx.description,
      alternates: undefined,
      openGraph: { type: "website", url: undefined },
      twitter: { card: "summary" },
    });
  });

  it("builds WebSite, software, and blog structured data", () => {
    expect(buildWebSiteJsonLd(ctx)).toMatchObject({
      "@type": "WebSite",
      name: ctx.name,
      url: ctx.url,
      publisher: { "@type": "Organization", name: "馒头助手" },
    });
    expect(buildSoftwareApplicationJsonLd(ctx)).toMatchObject({
      "@type": "SoftwareApplication",
      operatingSystem: "iOS",
      softwareRequirements: "iOS 15.0 or later",
      inLanguage: "zh-CN",
      url: "https://example.test/download",
      offers: { price: "0", priceCurrency: "CNY" },
    });
    expect(buildBlogJsonLd(ctx)).toMatchObject({
      "@type": "Blog",
      url: "https://example.test/?section=blog",
      publisher: { "@type": "Person", name: "Mantou" },
    });
  });

  it("builds complete and fallback BlogPosting structured data", () => {
    const updatedAt = new Date("2026-07-19T00:00:00.000Z");
    const publishedAt = new Date("2026-07-18T00:00:00.000Z");
    expect(
      buildBlogPostingJsonLd(ctx, {
        title: "Post",
        slug: "post",
        excerpt: "Excerpt",
        coverImage: "https://example.test/post.webp",
        publishedAt,
        updatedAt,
        authorName: "Author",
      })
    ).toMatchObject({
      "@type": "BlogPosting",
      headline: "Post",
      description: "Excerpt",
      datePublished: publishedAt.toISOString(),
      dateModified: updatedAt.toISOString(),
      image: ["https://example.test/post.webp"],
      mainEntityOfPage: "https://example.test/post/post",
    });

    const fallback = buildBlogPostingJsonLd(ctx, {
      title: "Fallback",
      slug: "fallback",
      excerpt: null,
      coverImage: null,
      publishedAt: null,
      updatedAt,
      authorName: "Author",
    });
    expect(fallback.description).toBe(ctx.description);
    expect(fallback.datePublished).toBeUndefined();
    expect(fallback).not.toHaveProperty("image");
  });

  it("loads the blog-mode keyword and publisher branches", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_MODE", "blog");
    vi.resetModules();
    const blogSeo = await import("@/lib/seo");

    expect(blogSeo.DEFAULT_KEYWORDS).toContain("技术博客");
    expect(blogSeo.resolveSiteUrl()).toBe("https://blog.cloudmantoua.top");
    expect(blogSeo.buildWebSiteJsonLd(ctx)).toMatchObject({
      alternateName: ["cloudmantoua.top", "馒头助手"],
      publisher: { name: "Mantou" },
    });
    expect(blogSeo.buildRootMetadata(ctx).alternates).toEqual({
      canonical: ctx.url,
    });
  });
});
