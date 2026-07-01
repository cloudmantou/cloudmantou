"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { PostMeta, estimateReadTime } from "@/components/blog/PostMeta";
import { LikeButton } from "@/components/blog/LikeButton";
import { CommentSection } from "@/components/blog/CommentSection";
import type { CommentData } from "@/components/blog/CommentItem";

type PostData = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
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
};

export function PostContent({ post, commentsData }: PostContentProps) {
  const [progress, setProgress] = useState(0);
  const isPaidOnly = post.status === "PAID_ONLY";

  // Reading progress bar
  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      {/* Reading progress */}
      <div
        className="reading-progress"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />

      {/* Top bar */}
      <div
        className="sticky top-0 z-50 flex items-center px-4 sm:px-8 py-3"
        style={{
          background: "color-mix(in srgb, var(--article-bg) 85%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--article-border)",
        }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回首页
        </Link>
      </div>

      {/* Article content */}
      <article className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Cover image */}
        {post.coverImage && (
          <div
            className="w-full aspect-[21/9] rounded-xl mb-8 bg-cover bg-center"
            style={{ backgroundImage: `url(${post.coverImage})` }}
            role="img"
            aria-label={post.title}
          />
        )}

        {/* Title */}
        <h1
          className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 leading-tight"
          style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--article-heading)" }}
        >
          {post.title}
        </h1>

        {/* Meta */}
        <PostMeta
          author={post.author}
          publishedAt={post.publishedAt}
          viewCount={post.viewCount}
          commentCount={post.commentCount}
          category={post.category}
          tags={post.tags}
          readTime={estimateReadTime(post.content)}
        />

        {/* Content */}
        {post.content ? (
          <MarkdownRenderer content={post.content} />
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
                <h3>会员专属内容</h3>
                <p>购买后即可阅读全文</p>
                {post.paidContent && (
                  <div className="paid-price">¥{post.paidContent.price.toFixed(2)}</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Like button */}
        <div className="flex items-center gap-4 mt-10 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <LikeButton
            slug={post.slug}
            initialLiked={post.isLiked}
            initialCount={post.likeCount}
          />
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
          >
            觉得不错？点个赞吧
          </span>
        </div>

        {/* Comments */}
        <CommentSection
          slug={post.slug}
          initialComments={commentsData.comments}
          totalCount={commentsData.totalCount}
          initialHasMore={commentsData.hasMore}
          initialNextCursor={commentsData.nextCursor}
        />
      </article>
    </>
  );
}
