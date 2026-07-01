"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, MessageSquare, FolderOpen, Hash, ArrowRight, AlertCircle } from "lucide-react";

type Stats = {
  metrics: {
    posts: number;
    users: number;
    orders: number;
    revenue: number;
  };
  attention: Array<{
    type: string;
    title: string;
    link: string;
  }>;
};

const modules = [
  { label: "文章管理", desc: "创建、编辑、发布文章。", href: "/admin/posts", icon: FileText, color: "var(--accent)" },
  { label: "评论审核", desc: "审核用户评论。", href: "/admin/comments", icon: MessageSquare, color: "var(--teal)" },
  { label: "分类管理", desc: "管理文章分类。", href: "/admin/categories", icon: FolderOpen, color: "var(--blue)" },
  { label: "标签管理", desc: "管理文章标签。", href: "/admin/tags", icon: Hash, color: "var(--orange)" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="home-greeting">Admin Console</p>
        <h1 className="page-title">后台管理</h1>
        <p className="page-desc">管理文章、评论、分类和标签。</p>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="metrics-grid mb-6">
            <div className="metric-card">
              <div className="metric-value">{stats.metrics.posts}</div>
              <div className="metric-label">文章总数</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{stats.metrics.users}</div>
              <div className="metric-label">注册用户</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{stats.metrics.orders}</div>
              <div className="metric-label">已付订单</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">¥{stats.metrics.revenue.toFixed(0)}</div>
              <div className="metric-label">总收入</div>
            </div>
          </div>

          {/* Attention items */}
          {stats.attention.length > 0 && (
            <div className="mb-6">
              <h2 className="section-title mb-3">待处理事项</h2>
              <div className="flex flex-col gap-2">
                {stats.attention.map((item, i) => (
                  <Link
                    key={i}
                    href={item.link}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:border-[var(--accent)]"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: item.type === "warning" ? "var(--orange)" : "var(--text-secondary)",
                      fontFamily: '"JetBrains Mono", monospace',
                      textDecoration: "none",
                    }}
                  >
                    <AlertCircle size={13} aria-hidden="true" />
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Module cards */}
      <div className="grid grid-cols-2 gap-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="workspace-panel group flex items-start gap-3"
              style={{ textDecoration: "none" }}
            >
              <div
                className="p-2 rounded-lg"
                style={{ background: `${mod.color}15` }}
              >
                <Icon size={20} style={{ color: mod.color }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold mb-0.5" style={{ color: "var(--text)" }}>
                  {mod.label}
                </h2>
                <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>
                  {mod.desc}
                </p>
              </div>
              <ArrowRight
                size={14}
                className="mt-1 opacity-0 group-hover:opacity-60 transition-opacity"
                style={{ color: "var(--text-muted)" }}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
