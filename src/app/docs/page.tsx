import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialPublicHero, EditorialPublicSection } from "@/components/editorial/EditorialPublicPage";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages, localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.docs;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/docs",
  });
}

export default async function DocsPage() {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.docs;
  let posts: Array<{ title: string; slug: string; excerpt: string | null }> = [];
  try {
    if (locale === "en") throw new Error("English editorial content is not published yet");
    posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: { title: true, slug: true, excerpt: true },
    });
  } catch {
    posts = [];
  }

  return (
    <EditorialShell locale={locale}>
      <EditorialPublicHero
        eyebrow={locale === "en" ? "GUIDES / VERIFIED STEPS" : "指南 / 可验证步骤"}
        title={copy.title}
        description={copy.description}
      />
      <EditorialPublicSection title={locale === "en" ? "Start here" : "从这里开始"}>
      <div className="editorial-public-card-grid">
        {copy.guides.filter((guide) => guide.href !== "/store").map((guide, index) => (
          <Link key={guide.href} href={localizeOfficialPath(guide.href, locale)} className={`editorial-public-card editorial-guide-card accent-${index % 3}`}>
            <span className="editorial-public-index">{String(index + 1).padStart(2, "0")}</span>
            <h3>{guide.title}</h3>
            <p>{guide.desc}</p>
          </Link>
        ))}
      </div>
      </EditorialPublicSection>
      {posts.length > 0 ? (
        <EditorialPublicSection title={copy.related}>
          <div className="editorial-guide-list">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={localizeOfficialPath(`/post/${post.slug}`, locale)}
              >
                <strong>{post.title}</strong>
                {post.excerpt ? (
                  <p>
                    {post.excerpt}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
          <Link href={localizeOfficialPath("/blog", locale)} className="editorial-button editorial-button-paper">
            {copy.allBlog}
          </Link>
        </EditorialPublicSection>
      ) : null}
    </EditorialShell>
  );
}
