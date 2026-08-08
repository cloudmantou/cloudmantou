import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { isOfficialSite } from "@/config/site";
import { getSeoContext } from "@/lib/seo";
import { localizeOfficialPath } from "@/i18n/official";
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
} from "@/lib/editorial-translations";
import { MANTOU_ASSISTANT_ARTICLE_EN } from "@/config/editorial-blog";
import { canUseStaticEnglishMantouFallback } from "@/lib/editorial-static-fallback";

// Sitemap includes database-backed editorial entries, so generate it at request time.
// This keeps release builds independent from production database availability.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url: baseUrl } = await getSeoContext();

  const officialPaths = [
    { path: "/features", changeFrequency: "monthly", priority: 0.85 },
    { path: "/download", changeFrequency: "monthly", priority: 0.95 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.75 },
    { path: "/blog", changeFrequency: "daily", priority: 0.65 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.35 },
    { path: "/disclaimer", changeFrequency: "monthly", priority: 0.35 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.45 },
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
  ];

  try {
    const posts = await prisma.post.findMany({
      where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
      select: {
        slug: true,
        status: true,
        updatedAt: true,
        translations: {
          where: {
            locale: ENGLISH_POST_TRANSLATION_LOCALE,
            status: ENGLISH_POST_TRANSLATION_STATUS,
          },
          select: { updatedAt: true },
          take: 1,
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    const postPages: MetadataRoute.Sitemap = posts.flatMap((p) => {
      const locales = isOfficialSite && p.status === "PUBLISHED" && p.translations.length > 0 ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/post/${p.slug}`, locale)}`,
        lastModified: locale === "en" ? p.translations[0]?.updatedAt || p.updatedAt : p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.6 : 0.8,
      }));
    });
    if (isOfficialSite) {
      const fallbackSource = await prisma.post.findUnique({
        where: { slug: MANTOU_ASSISTANT_ARTICLE_EN.slug },
        select: {
          title: true,
          excerpt: true,
          content: true,
          status: true,
          translations: {
            where: { locale: ENGLISH_POST_TRANSLATION_LOCALE },
            select: { status: true },
          },
        },
      });
      const fallbackUrl = `${baseUrl}${localizeOfficialPath(`/post/${MANTOU_ASSISTANT_ARTICLE_EN.slug}`, "en")}`;
      if (
        canUseStaticEnglishMantouFallback(fallbackSource)
        && !postPages.some((entry) => entry.url === fallbackUrl)
      ) {
        postPages.push({
          url: fallbackUrl,
          lastModified: new Date(MANTOU_ASSISTANT_ARTICLE_EN.publishedAt),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }

    const categories = await prisma.category.findMany({
      select: {
        slug: true,
        _count: {
          select: {
            posts: {
              where: {
                status: "PUBLISHED",
                translations: {
                  some: {
                    locale: ENGLISH_POST_TRANSLATION_LOCALE,
                    status: ENGLISH_POST_TRANSLATION_STATUS,
                  },
                },
              },
            },
          },
        },
      },
    });
    const categoryPages: MetadataRoute.Sitemap = categories.flatMap((category) => {
      const locales = isOfficialSite && category._count.posts > 0 ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/category/${category.slug}`, locale)}`,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.5 : 0.6,
      }));
    });

    const tags = await prisma.tag.findMany({
      select: {
        slug: true,
        _count: {
          select: {
            posts: {
              where: {
                post: {
                  status: "PUBLISHED",
                  translations: {
                    some: {
                      locale: ENGLISH_POST_TRANSLATION_LOCALE,
                      status: ENGLISH_POST_TRANSLATION_STATUS,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const tagPages: MetadataRoute.Sitemap = tags.flatMap((tag) => {
      const locales = isOfficialSite && tag._count.posts > 0 ? (["zh", "en"] as const) : (["zh"] as const);
      return locales.map((locale) => ({
        url: `${baseUrl}${localizeOfficialPath(`/tag/${tag.slug}`, locale)}`,
        changeFrequency: "weekly" as const,
        priority: isOfficialSite ? 0.45 : 0.55,
      }));
    });

    return [...staticPages, ...postPages, ...categoryPages, ...tagPages];
  } catch {
    return staticPages;
  }
}
