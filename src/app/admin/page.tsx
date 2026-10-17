"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiEnvelope } from "@/lib/client-api-response";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  FolderOpen,
  Hash,
  ArrowRight,
  AlertCircle,
  Loader2,
  Users,
  CreditCard,
  KeyRound,
  ShoppingCart,
  Settings,
  RefreshCw,
  Plus,
} from "lucide-react";

type Stats = {
  metrics: {
    posts: number;
    users: number;
    orders: number;
    revenue: number;
    pendingComments: number;
    activeCards: number;
    activeMembers: number;
  };
  attention: Array<{ type: string; title: string; link: string }>;
  recentPosts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    viewCount: number;
    commentCount: number;
    publishedAt: string | null;
    category: { name: string } | null;
  }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    title: string;
    amount: number;
    status: string;
    createdAt: string;
    user: { username: string; nickname: string | null };
  }>;
  recentComments: Array<{
    id: string;
    content: string;
    status: string;
    createdAt: string;
    user: { username: string; nickname: string | null };
    post: { title: string };
  }>;
  publishTrend: Array<{ label: string; value: number; height: number }>;
  revenueBreakdown: Array<{ type: string; amount: number; percent: number }>;
  activity: Array<{ type: string; color: string; text: string; time: string }>;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  PAID_ONLY: "付费",
  PENDING: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  VIP_MONTH: "月度会员",
  VIP_QUARTER: "季度会员",
  VIP_YEAR: "年度会员",
  PAID_POST: "付费专栏",
  CARD_PACKAGE: "卡密销售",
};

const REVENUE_COLORS = ["var(--accent)", "var(--teal)", "var(--orange)", "var(--blue)", "var(--text-muted)"];

const modules = [
  { label: "文章管理", desc: "创建、编辑、发布文章。", href: "/admin/posts", icon: FileText, color: "var(--accent)" },
  { label: "评论审核", desc: "审核用户评论。", href: "/admin/comments", icon: MessageSquare, color: "var(--teal)" },
  { label: "分类管理", desc: "管理文章分类。", href: "/admin/categories", icon: FolderOpen, color: "var(--blue)" },
  { label: "标签管理", desc: "管理文章标签。", href: "/admin/tags", icon: Hash, color: "var(--orange)" },
  { label: "用户管理", desc: "管理注册用户与权限。", href: "/admin/users", icon: Users, color: "var(--blue)" },
  { label: "卡密管理", desc: "生成和管理兑换卡密。", href: "/admin/cards", icon: KeyRound, color: "var(--accent)" },
  { label: "订单管理", desc: "查看交易订单。", href: "/admin/orders", icon: ShoppingCart, color: "var(--teal)" },
  { label: "支付对接", desc: "配置支付宝、微信等支付通道。", href: "/admin/payment-gateway", icon: CreditCard, color: "var(--orange)" },
  { label: "支付记录", desc: "支付流水与对账。", href: "/admin/payments", icon: CreditCard, color: "var(--text-muted)" },
  { label: "系统设置", desc: "配置站点参数。", href: "/admin/settings", icon: Settings, color: "var(--text-muted)" },
];

function formatRelativeTime(iso: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function formatRevenue(value: number) {
  return value >= 1000 ? `¥${(value / 1000).toFixed(1)}K` : `¥${value.toFixed(2)}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 刷新时保留旧数据，只在按钮上显示加载状态，避免整个面板闪烁消失。
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      const body = await readApiEnvelope(res, "获取数据失败");
      setStats(body.data as Stats);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const donutGradient =
    stats?.revenueBreakdown && stats.revenueBreakdown.length > 0
      ? (() => {
          let offset = 0;
          return stats.revenueBreakdown
            .map((r, i) => {
              const start = offset;
              offset += r.percent;
              return `${REVENUE_COLORS[i % REVENUE_COLORS.length]} ${start}% ${offset}%`;
            })
            .join(", ");
        })()
      : "var(--accent) 0% 100%";

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2>仪表盘总览</h2>
          <p>
            {stats?.updatedAt
              ? `数据更新于 ${new Date(stats.updatedAt).toLocaleString("zh-CN")}`
              : "加载数据中..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
            {loading ? "刷新中" : "刷新"}
          </button>
          <Link href="/admin/posts/new" className="admin-btn admin-btn-accent admin-btn-sm" style={{ textDecoration: "none" }}>
            <Plus size={13} />
            新建文章
          </Link>
        </div>
      </div>

      {loading && !stats && (
        <div className="admin-panel" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 size={16} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>加载中...</span>
        </div>
      )}

      {error && (
        <div className="admin-panel" role="alert" style={{ padding: 24, marginBottom: 16, textAlign: "center", color: "var(--rose)" }}>
          <p style={{ fontSize: 12, marginBottom: 8 }}>
            {error}
            {stats ? "（当前显示的是上次成功加载的数据）" : ""}
          </p>
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="admin-stats-grid">
            <Link href="/admin/posts" className="admin-stat-card" style={{ textDecoration: "none" }}>
              <div className="admin-stat-header">
                <div className="admin-stat-icon purple">✎</div>
              </div>
              <div className="admin-stat-value">{stats.metrics.posts}</div>
              <div className="admin-stat-label">总文章数</div>
            </Link>
            <Link href="/admin/users" className="admin-stat-card" style={{ textDecoration: "none" }}>
              <div className="admin-stat-header">
                <div className="admin-stat-icon green">◉</div>
              </div>
              <div className="admin-stat-value">{stats.metrics.users}</div>
              <div className="admin-stat-label">注册用户</div>
            </Link>
            <Link href="/admin/orders" className="admin-stat-card" style={{ textDecoration: "none" }}>
              <div className="admin-stat-header">
                <div className="admin-stat-icon yellow">◆</div>
              </div>
              <div className="admin-stat-value" title={`¥${stats.metrics.revenue.toFixed(2)}`}>
                {formatRevenue(stats.metrics.revenue)}
              </div>
              <div className="admin-stat-label">总收入 · {stats.metrics.orders} 笔已支付</div>
            </Link>
            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <div className="admin-stat-icon blue">★</div>
              </div>
              <div className="admin-stat-value">{stats.metrics.activeMembers}</div>
              <div className="admin-stat-label">活跃会员</div>
            </div>
          </div>

          {stats.attention.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div className="admin-panel-title">待处理事项</div>
                </div>
                <div className="admin-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.attention.map((item, i) => (
                    <Link
                      key={i}
                      href={item.link}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        color: item.type === "warning" ? "var(--orange)" : "var(--text-secondary)",
                        fontSize: 12,
                        textDecoration: "none",
                      }}
                    >
                      <AlertCircle size={13} />
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">发布趋势</div>
                  <div className="admin-panel-subtitle">
                    近 7 天发布 {stats.publishTrend.reduce((sum, d) => sum + d.value, 0)} 篇文章
                  </div>
                </div>
              </div>
              <div className="admin-panel-body">
                <div className="admin-chart-bars">
                  {stats.publishTrend.map((d, i) => (
                    <div className="admin-chart-bar-group" key={`${d.label}-${i}`} title={`${d.label}：${d.value} 篇`}>
                      <div className="admin-chart-bar-wrap">
                        <div className="admin-chart-bar" style={{ height: `${d.height}%` }} />
                      </div>
                      <span className="admin-chart-bar-label">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">收入构成</div>
                  <div className="admin-panel-subtitle">各商品类型占比</div>
                </div>
              </div>
              <div className="admin-panel-body">
                <div className="admin-donut-wrap">
                  <div className="admin-donut" style={{ background: `conic-gradient(${donutGradient})` }}>
                    <div className="admin-donut-center">
                      <strong>{formatRevenue(stats.metrics.revenue)}</strong>
                      <span>总收入</span>
                    </div>
                  </div>
                  <div className="admin-donut-legend">
                    {(stats.revenueBreakdown.length > 0
                      ? stats.revenueBreakdown
                      : [{ type: "暂无数据", amount: 0, percent: 100 }]
                    ).map((r, i) => (
                      <div className="admin-legend-item" key={r.type}>
                        <div
                          className="admin-legend-dot"
                          style={{ background: REVENUE_COLORS[i % REVENUE_COLORS.length] }}
                        />
                        {PRODUCT_TYPE_LABELS[r.type] || r.type}
                        <span className="admin-legend-value">{r.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">最新文章</div>
                  <div className="admin-panel-subtitle">最近创建的文章</div>
                </div>
                <Link href="/admin/posts" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: "none" }}>
                  查看全部
                </Link>
              </div>
              <div className="admin-panel-body-compact">
                <table className="admin-key-table">
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>状态</th>
                      <th>浏览</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentPosts.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                          暂无文章
                        </td>
                      </tr>
                    ) : (
                      stats.recentPosts.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 500, color: "var(--text)" }}>{p.title}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {p.category?.name || "—"}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`admin-badge ${
                                p.status === "PUBLISHED" ? "success" : p.status === "DRAFT" ? "warning" : "purple"
                              }`}
                            >
                              {STATUS_LABELS[p.status]}
                            </span>
                          </td>
                          <td className="mono">{p.viewCount}</td>
                          <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {p.publishedAt && p.status !== "DRAFT" ? formatRelativeTime(p.publishedAt) : "未发布"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">最近动态</div>
                  <div className="admin-panel-subtitle">支付、待审评论与发布</div>
                </div>
              </div>
              <div className="admin-panel-body">
                <div className="admin-activity-list">
                  {stats.activity.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>暂无动态</p>
                  ) : (
                    stats.activity.map((a, i) => (
                      <div className="admin-activity-item" key={i}>
                        <div className="admin-activity-dot" style={{ background: a.color }} />
                        <div className="admin-activity-content">
                          <p>{a.text}</p>
                          <time>{formatRelativeTime(a.time)}</time>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <h2 className="section-title" style={{ marginTop: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
        管理模块
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="admin-panel"
              style={{
                padding: 16,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}
            >
              <div style={{ padding: 8, borderRadius: 8, background: `color-mix(in srgb, ${mod.color} 12%, transparent)` }}>
                <Icon size={20} style={{ color: mod.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  {mod.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{mod.desc}</div>
              </div>
              <ArrowRight size={14} style={{ color: "var(--text-muted)", marginTop: 4 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}