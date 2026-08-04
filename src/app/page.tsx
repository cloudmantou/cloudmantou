import type { Metadata } from "next";
import { EditorialBlogHome } from "@/components/editorial/EditorialBlogHome";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";

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

  if (locale === "zh") {
    try {
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
    } catch (error) {
      console.error("[Editorial Home] Unable to load posts; using static fallback", error);
      posts = [];
    }
  }

  return <EditorialBlogHome posts={posts} locale={locale} />;
}
