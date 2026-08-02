import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { localizeOfficialPath } from "@/i18n/official";

export type EditorialPostCardData = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  status: "DRAFT" | "PUBLISHED" | "PAID_ONLY";
  category: { name: string } | null;
  author?: { username: string; nickname: string | null };
};

function safeCoverStyle(value: string | null) {
  const cover = value?.trim();
  if (!cover) return undefined;
  const isLocal = /^\/(uploads|brand|editorial)\/[\w./-]+$/.test(cover);
  let isHttps = false;
  try {
    isHttps = new URL(cover).protocol === "https:";
  } catch {
    isHttps = false;
  }
  return isLocal || isHttps ? { backgroundImage: `url(${JSON.stringify(cover)})` } : undefined;
}

export function EditorialArticleCard({
  post,
  locale,
  variant = "card",
  index = 0,
}: {
  post: EditorialPostCardData;
  locale: "zh" | "en";
  variant?: "feature" | "lead" | "card" | "row";
  index?: number;
}) {
  const date = post.publishedAt
    ? post.publishedAt.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : locale === "en" ? "Draft note" : "持续更新";
  const author = post.author?.nickname || post.author?.username || (locale === "en" ? "Mantou" : "馒头");

  return (
    <Link
      className={`editorial-article editorial-article-${variant} accent-${index % 3}`}
      href={localizeOfficialPath(`/post/${post.slug}`, locale)}
    >
      <span
        className="editorial-article-media"
        style={safeCoverStyle(post.coverImage)}
        role={post.coverImage ? "img" : undefined}
        aria-label={post.coverImage ? post.title : undefined}
      >
        {!post.coverImage ? <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> : null}
      </span>
      <span className="editorial-article-copy">
        <span className="editorial-article-meta">
          <span>{post.category?.name || (locale === "en" ? "Field notes" : "实践记录")}</span>
          <time>{date}</time>
          {post.status === "PAID_ONLY" ? <LockKeyhole size={14} aria-label={locale === "en" ? "Premium article" : "付费文章"} /> : null}
        </span>
        <strong>{post.title}</strong>
        {post.excerpt ? <span className="editorial-article-excerpt">{post.excerpt}</span> : null}
        <span className="editorial-article-byline">{author}</span>
      </span>
      <span className="editorial-article-arrow" aria-hidden="true"><ArrowUpRight size={24} /></span>
    </Link>
  );
}
