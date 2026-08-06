import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { localizeOfficialPath } from "@/i18n/official";
import { isSafeCoverImageUrl } from "@/lib/safe-image-url";

export type EditorialPostCardData = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  status: "DRAFT" | "PUBLISHED" | "PAID_ONLY";
  isTop: boolean;
  category: { name: string } | null;
  author?: { username: string; nickname: string | null };
};

function safeCoverSource(value: string | null): string | null {
  const cover = value?.trim();
  return cover && isSafeCoverImageUrl(cover) ? cover : null;
}

function coverSizes(variant: NonNullable<Parameters<typeof EditorialArticleCard>[0]["variant"]>): string {
  if (variant === "feature") return "(max-width: 760px) calc(100vw - 32px), 240px";
  if (variant === "lead") return "(max-width: 760px) calc(100vw - 32px), (max-width: 1180px) 42vw, 430px";
  if (variant === "row") return "(max-width: 760px) calc(100vw - 32px), 220px";
  if (variant === "featured-lead") return "(max-width: 760px) calc(100vw - 32px), (max-width: 1180px) 48vw, 520px";
  return "(max-width: 760px) calc(100vw - 32px), (max-width: 1180px) 40vw, 360px";
}

export function EditorialArticleCard({
  post,
  locale,
  variant = "card",
  index = 0,
}: {
  post: EditorialPostCardData;
  locale: "zh" | "en";
  variant?: "feature" | "lead" | "card" | "row" | "featured-lead" | "featured-card";
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
  const coverImage = safeCoverSource(post.coverImage);

  return (
    <article className="editorial-article-item">
      <Link
        className={`editorial-article editorial-article-${variant} accent-${index % 3}`}
        href={localizeOfficialPath(`/post/${post.slug}`, locale)}
      >
      <span
        className="editorial-article-media"
      >
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            sizes={coverSizes(variant)}
            quality={72}
            unoptimized={coverImage.startsWith("/uploads/") || !coverImage.startsWith("/")}
          />
        ) : <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
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
    </article>
  );
}
