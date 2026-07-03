"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type DailyCommentUser = {
  id: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
};

type DailyComment = {
  id: string;
  content: string;
  createdAt: string;
  user: DailyCommentUser;
};

type DailyCommentSectionProps = {
  recordId: string;
  initialCount?: number;
};

export function DailyCommentSection({ recordId, initialCount = 0 }: DailyCommentSectionProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<DailyComment[]>([]);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadComments = (cursor?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    return fetch(`/api/daily-records/${recordId}/comments?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.data) return;
        if (cursor) {
          setComments((prev) => [...prev, ...d.data.comments]);
        } else {
          setComments(d.data.comments);
        }
        setTotalCount(d.data.totalCount ?? d.data.comments.length);
        setHasMore(d.data.hasMore);
        setNextCursor(d.data.nextCursor);
        setLoaded(true);
      });
  };

  useEffect(() => {
    if (open && !loaded) {
      setLoading(true);
      loadComments()
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, loaded, recordId]);

  const handleSubmit = () => {
    if (!content.trim() || content.length > 500) return;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/daily-records/${recordId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "评论失败");
        }
        const data = await res.json();
        setContent("");
        setComments((prev) => [data.data, ...prev]);
        setTotalCount((c) => c + 1);
        setOpen(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "评论失败");
      }
    });
  };

  return (
    <div className="daily-comments">
      <button
        type="button"
        className="daily-action"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle size={13} aria-hidden="true" />
        {totalCount > 0 ? `${totalCount} 条评论` : "评论"}
      </button>

      {open && (
        <div className="daily-comments-panel">
          {!session?.user ? (
            <p className="daily-comments-hint">
              <Link href="/login?callbackUrl=/">登录</Link> 后参与讨论
            </p>
          ) : (
            <div className="daily-comment-form">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                placeholder="写下你的评论..."
                rows={2}
                className="daily-comment-input"
              />
              {error && <p className="daily-comment-error">{error}</p>}
              <div className="daily-comment-form-actions">
                <span className="daily-comment-count">{content.length}/500</span>
                <button
                  type="button"
                  className="daily-comment-submit"
                  onClick={handleSubmit}
                  disabled={!content.trim() || isPending}
                >
                  <Send size={12} aria-hidden="true" />
                  {isPending ? "发送中..." : "发表"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="daily-comments-hint">加载中...</p>
          ) : comments.length > 0 ? (
            <ul className="daily-comment-list">
              {comments.map((comment) => (
                <li key={comment.id} className="daily-comment-item">
                  <span className="daily-comment-avatar">
                    {(comment.user.nickname || comment.user.username).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="daily-comment-meta">
                      <strong>{comment.user.nickname || comment.user.username}</strong>
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString("zh-CN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p>{comment.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : loaded ? (
            <p className="daily-comments-hint">暂无评论，来说两句吧</p>
          ) : null}

          {hasMore && (
            <button
              type="button"
              className="daily-comment-more"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await loadComments(nextCursor);
                });
              }}
            >
              <ChevronDown size={13} aria-hidden="true" />
              加载更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}