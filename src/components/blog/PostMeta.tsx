import Link from "next/link";
import { Calendar, Clock, Eye, MessageCircle } from "lucide-react";
import { AccentTag } from "@/components/ui/AccentTag";
import type { Accent } from "@/types";

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
};

export function PostMeta({
  author,
  publishedAt,
  viewCount,
  commentCount,
  category,
  tags,
  readTime,
}: PostMetaProps) {
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("zh-CN", {
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
            href={`/category/${category.slug}`}
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
          <AccentTag key={tag.id} accent={ACCENTS[i % ACCENTS.length]}>
            {tag.name}
          </AccentTag>
        ))}
      </div>
    </div>
  );
}

/** Estimate reading time from content length */
export function estimateReadTime(content: string | null): string {
  if (!content) return "付费内容";
  const chars = content.length;
  const minutes = Math.max(1, Math.ceil(chars / 500));
  return `${minutes} 分钟`;
}
