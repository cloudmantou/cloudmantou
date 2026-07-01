"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, Eye, ChevronDown } from "lucide-react";

type PostItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  createdAt: string;
  viewCount: number;
  author: {
    username: string;
    nickname: string | null;
  };
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

type CategoryPostsProps = {
  categoryId: string;
  initialPosts: PostItem[];
  initialHasMore: boolean;
};

export function CategoryPosts({
  categoryId,
  initialPosts,
  initialHasMore,
}: CategoryPostsProps) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (isPending) return;
    const nextPage = page + 1;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/posts?categoryId=${categoryId}&page=${nextPage}&pageSize=10`
        );
        const data = await res.json();
        if (data.data?.length > 0) {
          setPosts((prev) => [...prev, ...data.data]);
          setPage(nextPage);
          setHasMore(nextPage < data.pagination.totalPages);
        } else {
          setHasMore(false);
        }
      } catch {
        // Silently fail
      }
    });
  };

  return (
    <div className="blog-list">
      {posts.map((post) => {
        const dateStr = post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        return (
          <Link
            key={post.id}
            href={`/post/${post.slug}`}
            className="blog-card fade-up"
            style={{ textDecoration: "none" }}
          >
            <span className="blog-body">
              <span className="blog-meta">
                <span>{post.author.nickname || post.author.username}</span>
                {dateStr && (
                  <>
                    <span className="meta-dot" />
                    <span className="flex items-center gap-1">
                      <Calendar size={12} aria-hidden="true" />
                      {dateStr}
                    </span>
                  </>
                )}
                <span className="meta-dot" />
                <span className="flex items-center gap-1">
                  <Eye size={12} aria-hidden="true" />
                  {post.viewCount}
                </span>
              </span>
              {post.tags.length > 0 && (
                <span className="tag-row">
                  {post.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="accent-tag accent-gold"
                      style={{ fontSize: "10px" }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </span>
              )}
              <strong className="blog-title">{post.title}</strong>
              {post.excerpt && (
                <span className="blog-excerpt">{post.excerpt}</span>
              )}
            </span>
          </Link>
        );
      })}

      {hasMore && (
        <div className="text-center mt-4">
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
            {isPending ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
        >
          该分类暂无文章
        </div>
      )}
    </div>
  );
}
