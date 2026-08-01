import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OfficialShell } from "@/components/official/OfficialShell";
import { PageHeader } from "@/components/official/sections";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.blog;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/blog",
  });
}

export default async function BlogPage() {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.blog;
  let posts: Array<{
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: Date | null;
    category: { name: string } | null;
  }> = [];

  try {
    if (locale === "en") throw new Error("English editorial content is not published yet");
    posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
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
      <div className="official-container" style={{ display: "grid", gap: 12, paddingBottom: 56 }}>
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/post/${post.slug}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {post.category ? <span className="official-tag">{post.category.name}</span> : null}
              {post.publishedAt ? (
                <span className="official-tag">
                  {post.publishedAt.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}
                </span>
              ) : null}
            </div>
            <strong style={{ fontSize: "1.05rem" }}>{post.title}</strong>
            {post.excerpt ? (
              <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                {post.excerpt}
              </p>
            ) : null}
          </Link>
        ))}
        {posts.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>{copy.empty}</p>
        ) : null}
      </div>
    </OfficialShell>
  );
}
