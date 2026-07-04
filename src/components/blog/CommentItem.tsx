"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageCircle, User } from "lucide-react";
import { CommentForm } from "./CommentForm";
import { isSafeAvatarSrc } from "@/lib/safe-image-url";

export type CommentData = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  children?: CommentData[];
};

type CommentItemProps = {
  comment: CommentData;
  slug: string;
  depth?: number;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CommentItem({ comment, slug, depth = 0 }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [children, setChildren] = useState<CommentData[]>(comment.children || []);

  return (
    <div>
      <div className="comment-box">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            {isSafeAvatarSrc(comment.user.avatar) ? (
              <Image
                src={comment.user.avatar!}
                alt=""
                width={28}
                height={28}
                className="rounded-full object-cover"
              />
            ) : (
              <User size={14} aria-hidden="true" />
            )}
          </div>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text)" }}
          >
            {comment.user.nickname || comment.user.username}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p
          className="text-sm m-0 leading-relaxed"
          style={{ color: "var(--article-text-secondary, var(--text-secondary))" }}
        >
          {comment.content}
        </p>

        {/* Reply button */}
        {depth < 2 && (
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-1 mt-2 text-xs transition-colors"
            style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            <MessageCircle size={12} aria-hidden="true" />
            回复
          </button>
        )}
      </div>

      {/* Reply form */}
      {showReply && (
        <div className="mt-2 ml-8">
          <CommentForm
            slug={slug}
            parentId={comment.id}
            replyTo={comment.user.nickname || comment.user.username}
            onCancel={() => setShowReply(false)}
            onSubmitted={(newComment: CommentData) => {
              setChildren([...children, newComment]);
              setShowReply(false);
            }}
          />
        </div>
      )}

      {/* Children (nested replies) */}
      {children.length > 0 && (
        <div className="comment-reply-indent mt-2 flex flex-col gap-2">
          {children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              slug={slug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
