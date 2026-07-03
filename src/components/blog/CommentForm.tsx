"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type CommentFormProps = {
  slug: string;
  parentId?: string | null;
  replyTo?: string;
  onCancel?: () => void;
  onSubmitted?: (comment: any) => void;
};

export function CommentForm({
  slug,
  parentId = null,
  replyTo,
  onCancel,
  onSubmitted,
}: CommentFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (!session?.user) {
    return (
      <div
        className="text-center py-6 text-sm"
        style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
      >
        <Link href="/login?callbackUrl=/" style={{ color: "var(--accent)", textDecoration: "underline" }}>
          登录
        </Link>
        {" "}后参与讨论
      </div>
    );
  }

  const handleSubmit = () => {
    if (!content.trim() || content.length > 1000) return;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/posts/${slug}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            ...(parentId ? { parentId } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "评论失败");
        }
        const data = await res.json();
        setContent("");
        onSubmitted?.(data.data);
        onCancel?.();
      } catch (e: any) {
        setError(e.message || "评论失败");
      }
    });
  };

  return (
    <div>
      {replyTo && (
        <div
          className="text-xs mb-2"
          style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
        >
          回复 {replyTo}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论..."
        maxLength={1000}
        rows={parentId ? 3 : 4}
        className="w-full rounded-lg p-3 text-sm resize-none outline-none transition-colors"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontFamily: '"Inter", "PingFang SC", sans-serif',
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
      />
      {error && (
        <div className="text-xs mt-1" style={{ color: "var(--rose)" }}>
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span
          className="text-xs"
          style={{
            color: content.length > 900 ? "var(--rose)" : "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {content.length}/1000
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md transition-all"
            style={{
              background: content.trim() ? "var(--accent)" : "var(--border)",
              color: content.trim() ? "var(--bg)" : "var(--text-muted)",
              fontFamily: '"JetBrains Mono", monospace',
              opacity: isPending ? 0.7 : 1,
              cursor: content.trim() ? "pointer" : "not-allowed",
            }}
          >
            <Send size={12} aria-hidden="true" />
            {isPending ? "发送中..." : "发表"}
          </button>
        </div>
      </div>
    </div>
  );
}
