"use client";

import { ArrowLeft, Crown } from "lucide-react";
import type { BlogPost } from "@/types";
import { AccentTag } from "@/components/ui/AccentTag";

type ArticleOverlayProps = {
  post: BlogPost | null;
  onClose: () => void;
};

export function ArticleOverlay({ post, onClose }: ArticleOverlayProps) {
  if (!post) {
    return null;
  }

  return (
    <div className="article-overlay open" role="dialog" aria-modal="true" aria-label={post.title}>
      <div className="article-topbar">
        <button type="button" className="ghost-button" onClick={onClose}>
          <ArrowLeft size={15} aria-hidden="true" />
          返回列表
        </button>
        <div className="article-progress" />
      </div>
      <article className="article-shell">
        <div className="article-hero" style={{ backgroundImage: post.cover }}>
          <span>{post.icon}</span>
        </div>
        <div className="article-meta">
          <span>{post.date}</span>
          <span>{post.readTime}</span>
          {post.tags.map((tag) => (
            <AccentTag accent={tag.accent} key={tag.label}>
              {tag.label}
            </AccentTag>
          ))}
        </div>
        <h1>{post.title}</h1>
        <div className="article-content">
          {post.content.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {post.premium ? (
            <div className="paid-block">
              <Crown size={18} aria-hidden="true" />
              <div>
                <strong>会员专属章节</strong>
                <p>这里会在接入订单和 entitlement 后展示完整付费内容。</p>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
