"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CommentSection } from "./CommentSection";
import type { CommentData } from "./CommentItem";

type CommentSectionLoaderProps = {
  slug: string;
};

export function CommentSectionLoader({ slug }: CommentSectionLoaderProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/posts/${slug}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setComments(d.data.comments || []);
          setTotalCount(d.data.totalCount ?? d.data.comments?.length ?? 0);
          setHasMore(d.data.hasMore ?? false);
          setNextCursor(d.data.nextCursor ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text-muted)",
          padding: "32px 0",
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
        }}
      >
        <Loader2 size={14} className="animate-spin" />
        加载评论...
      </div>
    );
  }

  return (
    <CommentSection
      slug={slug}
      initialComments={comments}
      totalCount={totalCount}
      initialHasMore={hasMore}
      initialNextCursor={nextCursor}
    />
  );
}