"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { Plus, Trash2, Pin, PinOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type RecordItem = {
  id: string;
  content: string;
  photos: string[];
  mood: string | null;
  weather: string | null;
  location: string | null;
  visibility: string;
  isTop: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: { username: string; nickname: string | null };
  tagNames: string[];
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "公开",
  friends: "好友",
  link: "链接",
  private: "私密",
};

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "photo", label: "含图片" },
  { id: "top", label: "置顶" },
];

export default function AdminDailyRecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (p: number, f: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15", filter: f });
      const res = await fetch(`/api/admin/daily-records?${params}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setRecords(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
      setRecords([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page, filter);
  }, [page, filter, load]);

  const handleDelete = (id: string, preview: string) => {
    const label = preview.length > 30 ? `${preview.slice(0, 30)}…` : preview;
    if (!confirm(`确定删除「${label}」？此操作不可撤销。`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/daily-records/${id}`, { method: "DELETE" });
      if (res.ok) load(page, filter);
    });
  };

  const handleToggleTop = (id: string, isTop: boolean) => {
    startTransition(async () => {
      const res = await fetch(`/api/admin/daily-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTop: !isTop }),
      });
      if (res.ok) load(page, filter);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>日常记录</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
            共 {total} 条记录
          </p>
        </div>
        <Link
          href="/admin/daily-records/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace' }}
        >
          <Plus size={14} />
          发布记录
        </Link>
      </div>

      <div className="flex gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFilter(f.id); setPage(1); }}
            className="px-3 py-1.5 rounded-md text-[11px] border"
            style={{
              borderColor: filter === f.id ? "var(--accent)" : "var(--border)",
              background: filter === f.id ? "var(--accent-dim)" : "transparent",
              color: filter === f.id ? "var(--accent)" : "var(--text-muted)",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="text-xs mb-4" style={{ color: "var(--rose)" }}>{loadError}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)" }}>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>内容</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>作者</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>可见性</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>互动</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>时间</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{ padding: "32px 16px" }}>
                    <EmptyState
                      title="暂无日常记录"
                      description="点击右上角发布第一条动态。"
                      action={
                        <Link
                          href="/admin/daily-records/new"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg mt-3"
                          style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace', textDecoration: "none" }}
                        >
                          <Plus size={14} />
                          发布记录
                        </Link>
                      }
                    />
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="transition-colors" style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-2.5" style={{ maxWidth: 320 }}>
                    <div className="flex items-start gap-2">
                      {r.isTop ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                          置顶
                        </span>
                      ) : null}
                      <div>
                        <p className="text-xs line-clamp-2" style={{ color: "var(--text)" }}>{r.content}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.mood ? <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.mood}</span> : null}
                          {r.weather ? <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.weather}</span> : null}
                          {r.photos.length > 0 ? (
                            <span className="text-[10px]" style={{ color: "var(--teal)", fontFamily: '"JetBrains Mono", monospace' }}>
                              {r.photos.length} 图
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {r.author.nickname || r.author.username}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                      {VISIBILITY_LABELS[r.visibility] || r.visibility}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                    ♥ {r.likeCount} · 💬 {r.commentCount}
                  </td>
                  <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                    {new Date(r.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        title={r.isTop ? "取消置顶" : "置顶"}
                        onClick={() => handleToggleTop(r.id, r.isTop)}
                        disabled={isPending}
                        className="p-1.5 rounded-md border transition-colors"
                        style={{ borderColor: "var(--border)", color: r.isTop ? "var(--accent)" : "var(--text-muted)", background: "transparent" }}
                      >
                        {r.isTop ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        type="button"
                        title="删除"
                        onClick={() => handleDelete(r.id, r.content)}
                        disabled={isPending}
                        className="p-1.5 rounded-md border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--rose)", background: "transparent" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            disabled={page <= 1 || isPending}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded text-xs border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            上一页
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isPending}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded text-xs border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}