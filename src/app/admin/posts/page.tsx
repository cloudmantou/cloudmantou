"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Edit, Eye, Pin, Lock } from "lucide-react";

type Post = {
  id: string;
  title: string;
  slug: string;
  status: string;
  isTop: boolean;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  author: { username: string; nickname: string | null };
  category: { name: string; slug: string } | null;
  tags: Array<{ id: string; name: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  PAID_ONLY: "付费",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "var(--text-muted)",
  PUBLISHED: "var(--teal)",
  PAID_ONLY: "var(--accent)",
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadPosts = async (p: number, status?: string, q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15" });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/posts?${params}`);
      const data = await res.json();
      setPosts(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPosts(page, statusFilter, search);
  }, [page, statusFilter]);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？此操作不可撤销。`)) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
        if (res.ok) {
          loadPosts(page, statusFilter, search);
        }
      } catch {
        // ignore
      }
    });
  };

  const handleSearch = () => {
    setPage(1);
    loadPosts(1, statusFilter, search);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}
          >
            文章管理
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
            共 {total} 篇文章
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"DM Mono", monospace' }}
        >
          <Plus size={14} aria-hidden="true" />
          新建文章
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索标题..."
            className="flex-1 px-3 py-1.5 rounded-md text-xs outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="p-1.5 rounded-md border transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <Search size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-1">
          {[
            { id: "", label: "全部" },
            { id: "DRAFT", label: "草稿" },
            { id: "PUBLISHED", label: "已发布" },
            { id: "PAID_ONLY", label: "付费" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setStatusFilter(f.id); setPage(1); }}
              className="px-2.5 py-1 rounded-md text-[10px] border transition-colors"
              style={{
                borderColor: statusFilter === f.id ? "var(--accent)" : "var(--border)",
                background: statusFilter === f.id ? "var(--accent-dim)" : "transparent",
                color: statusFilter === f.id ? "var(--accent)" : "var(--text-muted)",
                fontFamily: '"DM Mono", monospace',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)" }}>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>标题</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>状态</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>分类</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>浏览</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>评论</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>暂无文章</td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="transition-colors" style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {post.isTop && <Pin size={12} style={{ color: "var(--accent)" }} aria-label="置顶" />}
                      <span className="font-medium truncate max-w-xs" style={{ color: "var(--text)" }}>
                        {post.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: `${STATUS_COLORS[post.status]}15`, color: STATUS_COLORS[post.status], fontFamily: '"DM Mono", monospace' }}
                    >
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {post.category?.name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
                    {post.viewCount}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
                    {post.commentCount}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/post/${post.slug}`}
                        className="p-1.5 rounded-md transition-colors hover:bg-[var(--card)]"
                        style={{ color: "var(--text-muted)" }}
                        title="查看"
                      >
                        <Eye size={14} aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="p-1.5 rounded-md transition-colors hover:bg-[var(--card)]"
                        style={{ color: "var(--text-muted)" }}
                        title="编辑"
                      >
                        <Edit size={14} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id, post.title)}
                        className="p-1.5 rounded-md transition-colors hover:bg-[var(--rose-dim)]"
                        style={{ color: "var(--rose)" }}
                        title="删除"
                        disabled={isPending}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className="w-7 h-7 rounded-md text-xs transition-colors"
              style={{
                background: p === page ? "var(--accent)" : "transparent",
                color: p === page ? "var(--bg)" : "var(--text-muted)",
                fontFamily: '"DM Mono", monospace',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
