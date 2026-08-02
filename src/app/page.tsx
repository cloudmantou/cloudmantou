import type { Metadata } from "next";
import { EditorialBlogHome } from "@/components/editorial/EditorialBlogHome";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

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
      posts = await prisma.post.findMany({
        where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
        orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
        take: 8,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          status: true,
          category: { select: { name: true } },
          author: { select: { username: true, nickname: true } },
        },
      });
    } catch {
      posts = [];
    }
  }

  return <EditorialBlogHome posts={posts} locale={locale} />;
}
