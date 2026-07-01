"use client";

import { useState, useTransition } from "react";
import { MessageCircle, ChevronDown } from "lucide-react";
import { CommentItem, type CommentData } from "./CommentItem";
import { CommentForm } from "./CommentForm";

type CommentSectionProps = {
  slug: string;
  initialComments: CommentData[];
  totalCount: number;
  initialHasMore: boolean;
  initialNextCursor: string | null;
};

export function CommentSection({
  slug,
  initialComments,
  totalCount,
  initialHasMore,
  initialNextCursor,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (!nextCursor || isPending) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/posts/${slug}/comments?cursor=${encodeURIComponent(nextCursor)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setComments((prev) => [...prev, ...data.data.comments]);
        setHasMore(data.data.hasMore);
        setNextCursor(data.data.nextCursor);
      } catch {
        // Silently fail
      }
    });
  };

  return (
    <section className="mt-12 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle size={20} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <h2
          className="text-lg font-bold m-0"
          style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}
        >
          评论
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"DM Mono", monospace' }}
        >
          {totalCount}
        </span>
      </div>

      {/* Comment form */}
      <div className="mb-8">
        <CommentForm
          slug={slug}
          onSubmitted={(newComment: CommentData) => {
            setComments((prev) => [newComment, ...prev]);
          }}
        />
      </div>

      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} slug={slug} />
          ))}
        </div>
      ) : (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
        >
          暂无评论，来说两句吧
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs rounded-lg border transition-colors"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              fontFamily: '"DM Mono", monospace',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <ChevronDown size={14} aria-hidden="true" />
            {isPending ? "加载中..." : "加载更多评论"}
          </button>
        </div>
      )}
    </section>
  );
}
