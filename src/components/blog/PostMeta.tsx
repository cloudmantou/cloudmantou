import Link from "next/link";
import { Calendar, Clock, Eye, MessageCircle } from "lucide-react";
import { AccentTag } from "@/components/ui/AccentTag";
import type { Accent } from "@/types";
import { localizeOfficialPath } from "@/i18n/official";

const ACCENTS: Accent[] = ["gold", "teal", "rose", "blue", "orange"];

type PostMetaProps = {
  author: {
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  publishedAt: string | null;
  viewCount: number;
  commentCount: number;
  category: {
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }>;
  readTime: string;
  locale?: "zh" | "en";
  wordCount?: number;
};

export function PostMeta({
  author,
  publishedAt,
  viewCount,
  commentCount,
  category,
  tags,
  readTime,
  locale = "zh",
  wordCount,
}: PostMetaProps) {
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="flex flex-col gap-3 mb-8">
      {/* Author + Date row */}
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}>
        <span className="font-medium" style={{ color: "var(--text)" }}>
          {author.nickname || author.username}
        </span>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <span className="flex items-center gap-1.5">
          <Calendar size={13} aria-hidden="true" />
          {dateStr}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={13} aria-hidden="true" />
          {readTime}
        </span>
        {typeof wordCount === "number" ? (
          <span>{locale === "en" ? `${wordCount.toLocaleString("en-US")} words` : `${wordCount.toLocaleString("zh-CN")} 字`}</span>
        ) : null}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
        <span className="flex items-center gap-1.5">
          <Eye size={13} aria-hidden="true" />
          {viewCount}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle size={13} aria-hidden="true" />
          {commentCount}
        </span>
      </div>

      {/* Category + Tags row */}
      <div className="flex flex-wrap items-center gap-2">
        {category && (
          <Link
            href={locale === "en" ? `/en/category/${category.slug}` : `/category/${category.slug}`}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{
              color: "var(--accent)",
              background: "var(--accent-dim)",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {category.name}
          </Link>
        )}
        {tags.map((tag, i) => (
          <Link key={tag.id} href={localizeOfficialPath(`/tag/${tag.slug}`, locale)}>
            <AccentTag accent={ACCENTS[i % ACCENTS.length]}>{tag.name}</AccentTag>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Count readable CJK characters plus Latin words while excluding Markdown syntax. */
export function countArticleWords(content: string | null): number {
  if (!content) return 0;
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~|\-]/g, " ");
  const cjk = plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const latin = plain
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ")
    .match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return cjk + latin;
}

/** Estimate reading time using a mixed CJK/Latin editorial baseline. */
export function estimateReadTime(content: string | null, locale: "zh" | "en" = "zh"): string {
  if (!content) return locale === "en" ? "Premium content" : "付费内容";
  const minutes = Math.max(1, Math.ceil(countArticleWords(content) / (locale === "en" ? 220 : 400)));
  return locale === "en" ? `${minutes} min read` : `${minutes} 分钟`;
}
