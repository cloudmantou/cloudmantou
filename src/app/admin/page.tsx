"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileText, MessageSquare, FolderOpen, Hash, ArrowRight, AlertCircle, Loader2, Users, CreditCard, KeyRound, ShoppingCart, Settings } from "lucide-react";

type Stats = {
  metrics: {
    posts: number;
    users: number;
    orders: number;
    revenue: number;
    pendingComments: number;
    activeCards: number;
  };
  attention: Array<{
    type: string;
    title: string;
    link: string;
  }>;
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "var(--text-muted)",
  PUBLISHED: "var(--teal)",
  PAID_ONLY: "var(--accent)",
  PENDING: "var(--orange)",
  PAID: "var(--teal)",
  CANCELLED: "var(--text-muted)",
  REFUNDED: "var(--rose)",
  APPROVED: "var(--teal)",
  REJECTED: "var(--rose)",
};

const modules = [
  { label: "文章管理", desc: "创建、编辑、发布文章。", href: "/admin/posts", icon: FileText, color: "var(--accent)" },
  { label: "评论审核", desc: "审核用户评论。", href: "/admin/comments", icon: MessageSquare, color: "var(--teal)" },
  { label: "分类管理", desc: "管理文章分类。", href: "/admin/categories", icon: FolderOpen, color: "var(--blue)" },
  { label: "标签管理", desc: "管理文章标签。", href: "/admin/tags", icon: Hash, color: "var(--orange)" },
  { label: "用户管理", desc: "管理注册用户与权限。", href: "/admin/users", icon: Users, color: "var(--blue)" },
  { label: "卡密管理", desc: "生成和管理兑换卡密。", href: "/admin/cards", icon: KeyRound, color: "var(--accent)" },
  { label: "订单管理", desc: "查看交易订单。", href: "/admin/orders", icon: ShoppingCart, color: "var(--teal)" },
  { label: "支付记录", desc: "支付流水与对账。", href: "/admin/payments", icon: CreditCard, color: "var(--orange)" },
  { label: "系统设置", desc: "配置站点参数。", href: "/admin/settings", icon: Settings, color: "var(--text-muted)" },
];

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d) => {
        setStats(d.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="home-greeting">Admin Console</p>
        <h1 className="page-title">
          欢迎回来，{session?.user?.nickname || session?.user?.username || "管理员"}
        </h1>
        <p className="page-desc">管理文章、评论、分类和标签。</p>
      </div>

      {/* Stats */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-12 rounded-lg mb-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>加载中...</span>
        </div>
      )}

      {error && (
        <div
          className="py-6 px-4 rounded-lg mb-6 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, marginBottom: 8 }}>
            获取数据失败
          </p>
          <button
            type="button"
            onClick={() => { setLoading(true); setError(false); window.location.reload(); }}
            className="text-xs px-3 py-1 rounded-md"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            重试
          </button>
        </div>
      )}

      {!loading && !error && stats && (
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

          {/* Recent Posts & Recent Comments */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Recent Posts */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>最新文章</span>
                <Link href="/admin/posts" className="text-[10px] transition-colors hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>
                  查看全部 →
                </Link>
              </div>
              <div>
                {stats.recentPosts.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-center" style={{ color: "var(--text-muted)" }}>暂无文章</div>
                ) : stats.recentPosts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{p.title}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.category?.name || "—"}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status], fontFamily: '"JetBrains Mono", monospace' }}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                        {p.viewCount} 浏览
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Comments */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>最新评论</span>
                <Link href="/admin/comments" className="text-[10px] transition-colors hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>
                  查看全部 →
                </Link>
              </div>
              <div>
                {stats.recentComments.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-center" style={{ color: "var(--text-muted)" }}>暂无评论</div>
                ) : stats.recentComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                      {(c.user.nickname || c.user.username)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-medium" style={{ color: "var(--text)" }}>{c.user.nickname || c.user.username}</span>
                        {" "}{c.content.slice(0, 60)}{c.content.length > 60 ? "..." : ""}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>→ {c.post.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Module cards */}
      <h2 className="section-title mb-3">管理模块</h2>
      <div className="grid grid-cols-3 gap-3">
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
