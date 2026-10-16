"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Check, X, Trash2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { clampPageAfterRemoval } from "@/lib/admin-pagination";

type Comment = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  user: { id: string; username: string; nickname: string | null };
  post: { id: string; title: string; slug: string };
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--orange)",
  APPROVED: "var(--teal)",
  REJECTED: "var(--rose)",
};

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (p: number, status?: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/comments?${params}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setComments(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e: any) {
      setLoadError(e.message || "加载失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page, statusFilter);
  }, [page, statusFilter, load]);

  // 操作后若当前筛选下这一条会消失（如“待审核”里通过一条），需要处理空页回退。
  const refreshAfterChange = async (removedFromView: boolean) => {
    const nextPage = removedFromView ? clampPageAfterRemoval(page, comments.length - 1) : page;
    if (nextPage !== page) setPage(nextPage);
    else await load(page, statusFilter);
  };

  const runAction = (request: () => Promise<Response>, fallback: string, removedFromView: boolean) => {
    setActionError("");
    startTransition(async () => {
      try {
        const res = await request();
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || fallback);
        }
        await refreshAfterChange(removedFromView);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : fallback);
      }
    });
  };

  const handleStatus = (id: string, newStatus: string) => {
    runAction(
      () =>
        fetch(`/api/admin/comments/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }),
      newStatus === "APPROVED" ? "通过评论失败" : "拒绝评论失败",
      statusFilter !== "" && statusFilter !== newStatus
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("确定删除此评论？此操作不可撤销。")) return;
    runAction(() => fetch(`/api/admin/comments/${id}`, { method: "DELETE" }), "删除评论失败", true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: '"Inter", "PingFang SC", sans-serif', color: "var(--text)" }}>
            评论审核
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
            共 {total} 条评论
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {[
          { id: "", label: "全部" },
          { id: "PENDING", label: "待审核" },
          { id: "APPROVED", label: "已通过" },
          { id: "REJECTED", label: "已拒绝" },
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
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError ? (
        <p className="mb-3 text-xs" style={{ color: "var(--rose)" }} role="alert">
          {actionError}
        </p>
      ) : null}

      {/* Comment list */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</div>
        ) : loadError ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--rose)" }}>{loadError}</div>
        ) : comments.length === 0 ? (
          <EmptyState
            title={statusFilter ? "该状态下没有评论" : "暂无评论"}
            description={statusFilter ? "切换其他状态查看。" : "还没有用户发表评论。"}
          />
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment-box">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {c.user.nickname || c.user.username}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: `color-mix(in srgb, ${STATUS_COLORS[c.status]} 12%, transparent)`, color: STATUS_COLORS[c.status], fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-sm m-0 mb-1.5" style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {c.content}
                  </p>
                  <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                    <MessageSquare size={10} aria-hidden="true" />
                    评论于
                    <Link href={`/post/${c.post.slug}`} className="hover:underline" style={{ color: "var(--accent)" }}>
                      {c.post.title}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.status !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => handleStatus(c.id, "APPROVED")}
                      disabled={isPending}
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--teal-dim)]"
                      style={{ color: "var(--teal)" }}
                      title="通过"
                      aria-label="通过评论"
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                  )}
                  {c.status !== "REJECTED" && (
                    <button
                      type="button"
                      onClick={() => handleStatus(c.id, "REJECTED")}
                      disabled={isPending}
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--orange-dim)]"
                      style={{ color: "var(--orange)" }}
                      title="拒绝"
                      aria-label="拒绝评论"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--rose-dim)]"
                    style={{ color: "var(--rose)" }}
                    title="删除"
                    aria-label="删除评论"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AdminPagination page={page} totalPages={totalPages} disabled={loading || isPending} onChange={setPage} />
    </div>
  );
}
