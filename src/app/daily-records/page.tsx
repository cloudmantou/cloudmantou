"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";

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
  createdAt: string;
  author: { id: string; username: string; nickname: string | null; avatar: string | null };
  tagNames: string[];
  likesCount: number;
};

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "photo", label: "图片" },
  { id: "text", label: "文字" },
  { id: "top", label: "置顶" },
];

export default function DailyRecordsPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20", filter });
      const res = await fetch(`/api/daily-records?${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRecords(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(page); }, [page, load]);

  const handleLike = async (id: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/daily-records/${id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRecords((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, likesCount: data.data.likeCount } : r
          )
        );
      }
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleDateString("zh-CN");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="mb-8 p-4 rounded-lg text-sm"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        {session ? (
          <>日常记录由管理员发布。登录后可在每条动态下方点赞互动。</>
        ) : (
          <>
            <Link href="/login" style={{ color: "var(--accent)" }}>登录</Link> 后可点赞互动。
          </>
        )}
        <Link href="/" style={{ color: "var(--accent)", marginLeft: 8 }}>返回首页 →</Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>时间线</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
            {total} 条记录
          </span>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFilter(f.id); setPage(1); }}
              className="px-2.5 py-1 rounded-md text-[10px] border transition-colors"
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">暂无记录</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-lg transition-all"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff" }}
                  >
                    {(r.author.nickname || r.author.username)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium" style={{ color: "var(--text)" }}>
                      {r.author.nickname || r.author.username}
                    </div>
                    <div className="text-[10px] flex items-center gap-1.5" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                      <span>{formatDate(r.createdAt)}</span>
                      {r.weather && <span>· {r.weather}</span>}
                      {r.mood && <span>· {r.mood}</span>}
                      {r.location && <span>· 📍 {r.location}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-sm mb-3 whitespace-pre-wrap" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
                {r.content}
              </div>

              {r.photos && r.photos.length > 0 && (
                <div
                  className="grid gap-1.5 mb-3"
                  style={{
                    gridTemplateColumns: r.photos.length === 1 ? "1fr" : r.photos.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
                  }}
                >
                  {r.photos.map((photo, i) => (
                    <div key={i} className="aspect-[4/3] rounded-md overflow-hidden" style={{ background: "var(--bg)" }}>
                      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex flex-wrap gap-1.5">
                  {r.tagNames.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleLike(r.id)}
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Heart size={14} />
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{r.likesCount}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {page < totalPages && (
        <div className="text-center py-6">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2 rounded-lg text-xs transition-colors"
            style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}