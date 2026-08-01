import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OfficialShell } from "@/components/official/OfficialShell";
import { PageHeader } from "@/components/official/sections";
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
    <OfficialShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <div className="official-container official-feature-grid" style={{ paddingBottom: 32 }}>
        {copy.guides.map((guide) => (
          <Link key={guide.href} href={localizeOfficialPath(guide.href, locale)} className="official-feature-card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{guide.title}</h3>
            <p>{guide.desc}</p>
          </Link>
        ))}
      </div>
      {posts.length > 0 ? (
        <div className="official-container" style={{ paddingBottom: 56 }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 16 }}>{copy.related}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/post/${post.slug}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              >
                <strong>{post.title}</strong>
                {post.excerpt ? (
                  <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                    {post.excerpt}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
          <Link href="/blog" className="official-btn official-btn-ghost" style={{ marginTop: 20 }}>
            {copy.allBlog}
          </Link>
        </div>
      ) : null}
    </OfficialShell>
  );
}
