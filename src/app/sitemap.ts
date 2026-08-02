import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { isOfficialSite } from "@/config/site";
import { getSeoContext } from "@/lib/seo";
import { localizeOfficialPath } from "@/i18n/official";

// Sitemap includes database-backed posts/store entries, so generate it at request time.
// This keeps release builds independent from production database availability.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url: baseUrl } = await getSeoContext();

  const officialPaths = [
    { path: "/features", changeFrequency: "monthly", priority: 0.85 },
    { path: "/store", changeFrequency: "weekly", priority: 0.95 },
    { path: "/download", changeFrequency: "monthly", priority: 0.95 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.75 },
    { path: "/blog", changeFrequency: "daily", priority: 0.65 },
  ] as const;
  const officialPages: MetadataRoute.Sitemap = isOfficialSite
    ? officialPaths.flatMap((page) => (["zh", "en"] as const).map((locale) => ({
      url: `${baseUrl}${localizeOfficialPath(page.path, locale)}`,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      })))
    : [];

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    ...(isOfficialSite ? [{ url: `${baseUrl}/en`, changeFrequency: "daily" as const, priority: 1 }] : []),
    ...officialPages,
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, changeFrequency: "monthly", priority: 0.3 },
    ...(isOfficialSite ? [
      { url: `${baseUrl}/en/login`, changeFrequency: "monthly" as const, priority: 0.3 },
      { url: `${baseUrl}/en/register`, changeFrequency: "monthly" as const, priority: 0.3 },
    ] : []),
  ];

  try {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    });

    const postPages: MetadataRoute.Sitemap = posts.flatMap((p) => {
      const locales = isOfficialSite && p.slug === "mantou-assistant" ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/post/${p.slug}`, locale)}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.6 : 0.8,
      }));
    });

    const storeApps = isOfficialSite
      ? await prisma.storeApp.findMany({
          where: { published: true },
          select: { slug: true, updatedAt: true },
        })
      : [];

    const storePages: MetadataRoute.Sitemap = storeApps.flatMap((app) =>
      (["zh", "en"] as const).map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/store/${app.slug}`, locale)}`,
        lastModified: app.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.88,
      }))
    );

    const categories = await prisma.category.findMany({ select: { slug: true } });
    const categoryPages: MetadataRoute.Sitemap = categories.flatMap((category) => {
      const locales = isOfficialSite && category.slug === "product-notes" ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/category/${category.slug}`, locale)}`,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.5 : 0.6,
      }));
    });

    const tags = await prisma.tag.findMany({ select: { slug: true } });
    const translatedTags = new Set(["ios", "indie-development", "product-practice"]);
    const tagPages: MetadataRoute.Sitemap = tags.flatMap((tag) => {
      const locales = isOfficialSite && translatedTags.has(tag.slug) ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/tag/${tag.slug}`, locale)}`,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.45 : 0.55,
      }));
    });

    return [...staticPages, ...storePages, ...postPages, ...categoryPages, ...tagPages];
  } catch {
    return staticPages;
  }
}
