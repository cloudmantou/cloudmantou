import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { EditorialBlogHome } from "@/components/editorial/EditorialBlogHome";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
  mapEnglishTranslatedPost,
} from "@/lib/editorial-translations";
import { canUseStaticEnglishMantouFallback } from "@/lib/editorial-static-fallback";
import { MANTOU_ASSISTANT_ARTICLE_EN } from "@/config/editorial-blog";

export const dynamic = "force-dynamic";

const EDITORIAL_HOME_POST_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
  status: true,
  isTop: true,
  category: { select: { name: true } },
  author: { select: { username: true, nickname: true } },
} as const;

const ENGLISH_HOME_POST_SELECT = {
  ...EDITORIAL_HOME_POST_SELECT,
  category: { select: { name: true, slug: true } },
  translations: {
    where: {
      locale: ENGLISH_POST_TRANSLATION_LOCALE,
      status: ENGLISH_POST_TRANSLATION_STATUS,
    },
    select: { title: true, excerpt: true },
    take: 1,
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const ctx = withEditorialSeoContext(await getSeoContext(locale));
  return buildPageMetadata(ctx, {
    title: locale === "en" ? "Mantou — Independent technology and product notes" : "馒头 — 技术与产品的独立笔记",
    description: locale === "en"
      ? "Real projects, deployment notes, independent development, and product retrospectives."
      : "记录真实项目、部署过程、独立开发与产品实践。少一点包装，多一点可验证的结果。",
    path: "/",
  });
}

export default async function HomePage() {
  const locale = await getRequestLocale();
  let posts: EditorialPostCardData[] = [];
  let allowStaticFallback = locale === "zh";

  try {
    if (locale === "zh") {
      const [featuredCandidates, recentCandidates] = await Promise.all([
        prisma.post.findMany({
          where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
          orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
          take: 5,
          select: EDITORIAL_HOME_POST_SELECT,
        }),
        prisma.post.findMany({
          where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: 10,
          select: EDITORIAL_HOME_POST_SELECT,
        }),
      ]);
      posts = [...featuredCandidates, ...recentCandidates];
    } else {
      const englishWhere: Prisma.PostWhereInput = {
        status: "PUBLISHED",
        translations: {
          some: {
            locale: ENGLISH_POST_TRANSLATION_LOCALE,
            status: ENGLISH_POST_TRANSLATION_STATUS,
          },
        },
      };
      const [featuredCandidates, recentCandidates, fallbackSource] = await Promise.all([
        prisma.post.findMany({
          where: englishWhere,
          orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
          take: 5,
          select: ENGLISH_HOME_POST_SELECT,
        }),
        prisma.post.findMany({
          where: englishWhere,
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: 10,
          select: ENGLISH_HOME_POST_SELECT,
        }),
        prisma.post.findUnique({
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
        }),
      ]);
      posts = [...featuredCandidates, ...recentCandidates].map(mapEnglishTranslatedPost);
      allowStaticFallback = canUseStaticEnglishMantouFallback(fallbackSource);
    }
  } catch (error) {
    console.error("[Editorial Home] Unable to load posts", error);
    posts = [];
    allowStaticFallback = locale === "zh";
  }

  return (
    <EditorialBlogHome
      posts={posts}
      locale={locale}
      allowStaticFallback={allowStaticFallback}
    />
  );
}
