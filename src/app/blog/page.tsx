import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArticleCard, type EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { getEditorialBlogCopy } from "@/config/editorial-blog";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getEditorialBlogCopy(locale);
  const ctx = withEditorialSeoContext(await getSeoContext(locale));
  return buildPageMetadata(ctx, {
    title: copy.nav[1].label,
    description: locale === "en" ? "Field notes from real software and product work." : "来自真实开发、部署与产品实践的文章。",
    path: "/blog",
  });
}

export default async function BlogPage() {
  const locale = await getRequestLocale();
  const copy = getEditorialBlogCopy(locale);
  let posts: EditorialPostCardData[] = [];

  if (locale === "zh") {
    try {
      posts = await prisma.post.findMany({
        where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
        orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
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

  return (
    <EditorialShell locale={locale}>
      <section className="editorial-archive-hero">
        <div className="editorial-container">
          <span>ARCHIVE / {new Date().getFullYear()}</span>
          <h1>{copy.nav[1].label}</h1>
          <p>{locale === "en" ? "Real projects, deployment notes, and product retrospectives." : "真实项目、部署记录、产品思考与踩坑复盘。"}</p>
        </div>
      </section>
      <section className="editorial-section editorial-archive-section">
        <div className="editorial-container editorial-archive-grid">
          {posts.map((post, index) => (
            <EditorialArticleCard key={post.slug} post={post} locale={locale} variant={index === 0 ? "lead" : "card"} index={index} />
          ))}
          {posts.length === 0 ? <p className="editorial-empty">{locale === "en" ? "English articles are being prepared." : "文章正在整理中。"}</p> : null}
        </div>
      </section>
    </EditorialShell>
  );
}
