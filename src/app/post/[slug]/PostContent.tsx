"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Crown, Ticket } from "lucide-react";
import type { PostAccessReason } from "@/lib/post-access";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { countArticleWords, estimateReadTime } from "@/components/blog/PostMeta";
import { LikeButton } from "@/components/blog/LikeButton";
import { CommentSection } from "@/components/blog/CommentSection";
import type { CommentData } from "@/components/blog/CommentItem";
import { EditorialArticleChrome } from "@/components/editorial/EditorialArticleChrome";
import { extractArticleHeadings, type AdjacentArticle } from "@/lib/editorial-article";
import type { OfficialLocale } from "@/i18n/official";
import { PostPurchaseButton } from "@/components/payment/PostPurchaseButton";

type PostData = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  updatedAt: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  author: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }>;
  paidContent: {
    price: number;
  } | null;
  isLiked: boolean;
};

type CommentsData = {
  comments: CommentData[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
};

type PostContentProps = {
  post: PostData;
  commentsData: CommentsData;
  accessReason?: PostAccessReason;
  articleCreditsAvailable?: number;
  locale: OfficialLocale;
  previousPost?: AdjacentArticle | null;
  nextPost?: AdjacentArticle | null;
};

export function PostContent({
  post,
  commentsData,
  accessReason = "no_access",
  articleCreditsAvailable = 0,
  locale,
  previousPost,
  nextPost,
}: PostContentProps) {
  const router = useRouter();
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const isPaidOnly = post.status === "PAID_ONLY";
  const canUseArticleCredit = accessReason === "article_credit_available" && articleCreditsAvailable > 0;
  const headings = extractArticleHeadings(post.content);
  const wordCount = countArticleWords(post.content);
  const readTime = estimateReadTime(post.content, locale);

  const handleUnlockWithCredit = async () => {
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await fetch(`/api/posts/${post.slug}/unlock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "解锁失败");
      }
      router.refresh();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "解锁失败");
    } finally {
      setUnlocking(false);
    }
  };

  // Reading progress bar
  useEffect(() => {
    let frame = 0;
    const handler = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? Math.min(1, window.scrollY / docHeight) : 0;
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${progress})`;
        }
      });
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {/* Reading progress */}
      <div
        ref={progressRef}
        className="reading-progress"
        style={{ transform: "scaleX(0)" }}
        aria-hidden="true"
      />

      <EditorialArticleChrome
        locale={locale}
        slug={post.slug}
        title={post.title}
        excerpt={post.excerpt}
        coverImage={post.coverImage}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
        authorName={post.author.nickname || post.author.username}
        category={post.category}
        tags={post.tags}
        headings={headings}
        wordCount={wordCount}
        readTime={readTime}
        viewCount={post.viewCount}
        commentCount={post.commentCount}
        previousPost={previousPost}
        nextPost={nextPost}
        recommendationHref={post.slug === "mantou-assistant" ? "/download" : "/pricing"}
        recommendationLabel={post.slug === "mantou-assistant" ? (locale === "en" ? "Get the tool" : "获取工具") : undefined}
        engagement={(
          <>
            <div className="editorial-article-engagement">
              <LikeButton slug={post.slug} initialLiked={post.isLiked} initialCount={post.likeCount} />
              <span>{locale === "en" ? "Found this useful? Leave a like." : "觉得不错？点个赞吧"}</span>
            </div>
            <CommentSection
              slug={post.slug}
              initialComments={commentsData.comments}
              totalCount={commentsData.totalCount}
              initialHasMore={commentsData.hasMore}
              initialNextCursor={commentsData.nextCursor}
            />
          </>
        )}
      >
        {post.content ? (
          <MarkdownRenderer content={post.content} locale={locale} />
        ) : isPaidOnly ? (
          <div>
            {/* Show excerpt as preview */}
            {post.excerpt && (
              <div className="article-prose mb-0">
                <p>{post.excerpt}</p>
              </div>
            )}
            {/* Paid overlay */}
            <div className="paid-overlay">
              <div className="paid-cta">
                <Crown size={24} style={{ color: "var(--accent)", margin: "0 auto 12px" }} aria-hidden="true" />
                <h3>{locale === "en" ? "Members-only article" : "会员专属内容"}</h3>
                <p>{canUseArticleCredit ? (locale === "en" ? "Use an article credit to unlock the full text" : "可使用文章券解锁全文") : (locale === "en" ? "Purchase access to read the full article" : "购买后即可阅读全文")}</p>
                {post.paidContent && !canUseArticleCredit ? (
                  <div className="paid-price">¥{post.paidContent.price.toFixed(2)}</div>
                ) : null}
                {canUseArticleCredit ? (
                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="quick-btn primary"
                      disabled={unlocking}
                      onClick={handleUnlockWithCredit}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <Ticket size={15} aria-hidden="true" />
                      {unlocking
                        ? (locale === "en" ? "Unlocking…" : "解锁中…")
                        : (locale === "en" ? `Use article credit (${articleCreditsAvailable} remaining)` : `使用文章券解锁（剩余 ${articleCreditsAvailable} 篇）`)}
                    </button>
                    {unlockError ? (
                      <p className="text-sm" style={{ color: "var(--rose)", marginTop: 10 }}>
                        {unlockError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <PostPurchaseButton
                  postId={post.id}
                  slug={post.slug}
                  status={post.status}
                  accessReason={accessReason}
                  price={post.paidContent?.price ?? null}
                  locale={locale}
                />
              </div>
            </div>
          </div>
        ) : null}
      </EditorialArticleChrome>
    </>
  );
}
