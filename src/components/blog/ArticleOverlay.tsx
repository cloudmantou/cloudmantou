"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, Loader2 } from "lucide-react";
import type { BlogPost } from "@/types";
import { AccentTag } from "@/components/ui/AccentTag";
import { CommentSectionLoader } from "@/components/blog/CommentSectionLoader";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";

type ArticleOverlayProps = {
  post: BlogPost | null;
  onClose: () => void;
};

type FullPost = {
  title: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  viewCount: number;
  author: { username: string; nickname: string | null };
  category: { name: string; slug?: string } | null;
  tags: Array<{ name: string; color: string | null }>;
  paidContent: { price: number } | null;
  accessReason?: string;
};

export function ArticleOverlay({ post, onClose }: ArticleOverlayProps) {
  const shellRef = useRef<HTMLElement>(null);
  const [fullPost, setFullPost] = useState<FullPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!post?.slug) {
      setFullPost(null);
      return;
    }
    setLoading(true);
    fetch(`/api/posts/${post.slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setFullPost(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [post?.slug]);

  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [post, onClose]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || !post) return;
    const onScroll = () => {
      const overlay = el.closest(".article-overlay") as HTMLElement | null;
      if (!overlay) return;
      const max = overlay.scrollHeight - overlay.clientHeight;
      setProgress(max > 0 ? Math.min(100, (overlay.scrollTop / max) * 100) : 0);
    };
    const overlay = el.closest(".article-overlay");
    overlay?.addEventListener("scroll", onScroll);
    return () => overlay?.removeEventListener("scroll", onScroll);
  }, [post, fullPost]);

  if (!post) return null;

  const title = fullPost?.title || post.title;
  const cover = fullPost?.coverImage
    ? `url('${fullPost.coverImage}')`
    : post.cover;
  const isPremium = !!fullPost?.paidContent || post.premium;
  const date = fullPost?.publishedAt
    ? new Date(fullPost.publishedAt).toLocaleDateString("zh-CN")
    : post.date;

  return (
    <div className="article-overlay open" role="dialog" aria-modal="true" aria-label={title}>
      <div className="article-topbar">
        <button type="button" className="ghost-button" onClick={onClose}>
          <ArrowLeft size={15} aria-hidden="true" />
          返回列表
        </button>
        <div className="article-progress" style={{ width: `${progress}%` }} />
      </div>
      <article className="article-shell" ref={shellRef}>
        {fullPost?.coverImage ? (
          <div
            className="article-cover-image"
            style={{ backgroundImage: `url('${fullPost.coverImage}')` }}
            role="img"
            aria-label={title}
          />
        ) : (
          <div className="article-hero" style={{ backgroundImage: cover }}>
            <span>{post.icon}</span>
          </div>
        )}
        <div className="article-meta">
          <span>{date}</span>
          <span>{post.readTime}</span>
          {fullPost?.category ? (
            <AccentTag accent="teal">{fullPost.category.name}</AccentTag>
          ) : null}
          {(fullPost?.tags?.length ? fullPost.tags.map((t, i) => (
            <AccentTag accent={post.tags[i]?.accent || "gold"} key={t.name}>
              {t.name}
            </AccentTag>
          )) : post.tags.map((tag) => (
            <AccentTag accent={tag.accent} key={tag.label}>
              {tag.label}
            </AccentTag>
          )))}
        </div>
        <h1>{title}</h1>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", padding: "24px 0" }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>加载文章内容...</span>
          </div>
        ) : (
          <div className="article-content">
            {fullPost?.content ? (
              <MarkdownRenderer
                content={fullPost.content}
                className="article-prose article-markdown"
              />
            ) : (
              <div className="article-markdown">
                {post.content.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
            {isPremium && fullPost?.accessReason !== "full" ? (
              <div className="paid-block">
                <Crown size={18} aria-hidden="true" />
                <div>
                  <strong>会员专属章节</strong>
                  <p>
                    {fullPost?.paidContent
                      ? `付费内容 ¥${fullPost.paidContent.price}，登录并购买后可阅读完整章节。`
                      : "登录或兑换卡密后可阅读完整付费内容。"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {post.slug && !loading ? (
          <CommentSectionLoader slug={post.slug} />
        ) : null}
      </article>
    </div>
  );
}