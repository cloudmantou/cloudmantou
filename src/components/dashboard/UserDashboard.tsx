"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  BookOpen,
  Copy,
  CreditCard,
  Crown,
  KeyRound,
  Loader2,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";

type UserProfile = {
  email: string;
  username: string;
  nickname: string | null;
  vipLevel: number;
  vipExpireAt: string | null;
  balance: number;
  vipActive: boolean;
  articleCredits: number;
  unlockedPosts: number;
  orderCount: number;
  createdAt: string;
};

type OrderFulfillment = {
  kind: "none" | "card" | "membership" | "article";
  message: string | null;
  card: { cardNo: string; cardSecret: string } | null;
};

type OrderItem = {
  id: string;
  orderNo: string;
  title: string;
  amount: number;
  status: string;
  productType: string;
  createdAt: string;
  paidAt: string | null;
  payment: { channel: string; status: string; tradeNo: string | null } | null;
  fulfillment?: OrderFulfillment;
};

const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "待支付", tone: "text-orange" },
  PAID: { label: "已支付", tone: "text-teal" },
  CANCELLED: { label: "已取消", tone: "text-muted" },
  EXPIRED: { label: "已过期", tone: "text-muted" },
  REFUNDED: { label: "已退款", tone: "text-rose" },
};

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserDashboard() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [cardSecret, setCardSecret] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paidNotice, setPaidNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "加载失败");
    setProfile(data.data);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await fetch("/api/orders?pageSize=10");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "加载订单失败");
      setOrders(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setOrders([]);
      setOrdersError(e instanceof Error ? e.message : "加载订单失败");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    loadOrders();
  }, [loadProfile, loadOrders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToOrders = () => {
      const el = document.getElementById("orders");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (window.location.hash === "#orders" || searchParams.get("paid") === "1") {
      window.requestAnimationFrame(scrollToOrders);
    }
    if (searchParams.get("paid") === "1") {
      setPaidNotice("支付成功，可在下方订单中查看卡密与交付信息。");
    }
  }, [searchParams]);

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setRedeeming(true);
    try {
      const res = await fetch("/api/cards/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNo: cardNo.trim(), cardSecret: cardSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "兑换失败");
      const benefit = data.data?.benefit?.message || "卡密兑换成功";
      setMessage(benefit);
      setCardNo("");
      setCardSecret("");
      await Promise.all([loadProfile(), loadOrders()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "兑换失败");
    } finally {
      setRedeeming(false);
    }
  };

  const displayName = profile?.nickname || profile?.username || "会员";

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <div className="home-greeting" aria-hidden="true">
            <span className="greeting-diamond" /> MEMBER CENTER
          </div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            会员中心
          </h1>
          <p className="page-desc" style={{ margin: 0 }}>
            查看会员状态、兑换卡密、浏览订单与已购权益。
          </p>
        </div>
        {!loading && profile ? (
          <div className="vip-panel metric-card">
            <Crown size={22} className={profile.vipActive ? "text-gold" : "text-muted"} aria-hidden="true" />
            <div>
              <strong>{profile.vipActive ? "会员有效" : "非会员"}</strong>
              <span>
                {profile.vipActive && profile.vipExpireAt
                  ? `到期 ${new Date(profile.vipExpireAt).toLocaleDateString("zh-CN")}`
                  : "购买会员或兑换卡密即可开通"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="data-panel-loading">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> 加载会员信息…
        </div>
      ) : null}

      {error && !loading ? (
        <div className="toast toast-err show" role="alert">
          {error}
        </div>
      ) : null}

      {profile ? (
        <>
          <div className="metrics-grid" style={{ marginBottom: 28 }}>
            <article className="metric-card fade-up">
              <div className="metric-value text-gold">{displayName}</div>
              <div className="metric-label">账户</div>
              <div className="metric-delta">{profile.email}</div>
            </article>
            <article className="metric-card fade-up" style={{ animationDelay: "60ms" }}>
              <div className={clsx("metric-value", profile.vipActive ? "text-teal" : "text-muted")}>
                {profile.vipActive ? `VIP ${profile.vipLevel}` : "未开通"}
              </div>
              <div className="metric-label">会员等级</div>
              <div className="metric-delta">
                {profile.vipExpireAt ? formatDate(profile.vipExpireAt) : "暂无到期时间"}
              </div>
            </article>
            <article className="metric-card fade-up" style={{ animationDelay: "120ms" }}>
              <div className="metric-value text-blue">{profile.articleCredits}</div>
              <div className="metric-label">文章券额度</div>
              <div className="metric-delta">阅读付费文章时自动消耗</div>
            </article>
            <article className="metric-card fade-up" style={{ animationDelay: "180ms" }}>
              <div className="metric-value text-rose">{profile.unlockedPosts}</div>
              <div className="metric-label">已解锁文章</div>
              <div className="metric-delta">共 {profile.orderCount} 笔订单</div>
            </article>
          </div>

          <div className="work-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <section className="data-panel">
              <div className="data-panel-header">
                <span className="data-panel-title">
                  <KeyRound size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                  卡密兑换
                </span>
                <span className="data-panel-meta">本站权益 / 外部卡密</span>
              </div>
              <div style={{ padding: 18 }}>
                <form onSubmit={handleRedeem}>
                  <div
                    className="dashboard-redeem-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <input
                      className="admin-input"
                      placeholder="卡号"
                      value={cardNo}
                      onChange={(e) => setCardNo(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <input
                      className="admin-input"
                      placeholder="卡密"
                      value={cardSecret}
                      onChange={(e) => setCardSecret(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <button className="admin-btn primary" type="submit" disabled={redeeming}>
                      {redeeming ? "兑换中…" : "立即兑换"}
                    </button>
                  </div>
                </form>
                {message ? (
                  <p className="text-sm" style={{ color: "var(--teal)", margin: 0 }}>
                    <Sparkles size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
                    {message}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-muted)", margin: 0 }}>
                    本站 VIP、文章券、余额卡密会写入账户权益；外部/通用卡密仅完成核销并显示兑换说明，不会自动解锁本站文章。
                  </p>
                )}
              </div>
            </section>

            <section className="data-panel">
              <div className="data-panel-header">
                <span className="data-panel-title">
                  <Wallet size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                  账户余额
                </span>
                <span className="data-panel-meta">BALANCE</span>
              </div>
              <div style={{ padding: 18 }}>
                <div className="metric-value text-gold" style={{ fontSize: 28, marginBottom: 8 }}>
                  {formatMoney(Number(profile.balance) / 100)}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)", margin: "0 0 14px" }}>
                  余额卡密兑换后会自动入账，可用于后续站内消费（功能持续完善中）。
                </p>
                <Link href="/" className="quick-btn ghost" style={{ display: "inline-flex" }}>
                  <CreditCard size={14} aria-hidden="true" />
                  去购买会员
                </Link>
              </div>
            </section>
          </div>

          <section className="data-panel" id="orders">
            <div className="data-panel-header">
              <span className="data-panel-title">
                <Receipt size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                订单历史
              </span>
              <span className="data-panel-meta">最近 10 笔</span>
            </div>
            {paidNotice ? (
              <div
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--teal)",
                  fontSize: 13,
                }}
              >
                <Sparkles size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                {paidNotice}
              </div>
            ) : null}
            {ordersLoading ? (
              <div className="data-panel-loading">加载订单…</div>
            ) : ordersError ? (
              <div className="data-panel-loading" style={{ color: "var(--rose)" }}>
                {ordersError}
                <button
                  type="button"
                  className="quick-btn ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => loadOrders()}
                >
                  重试
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="data-panel-loading">暂无订单，去首页购买会员套餐吧。</div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>订单号</th>
                      <th>商品</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>交付</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const status = ORDER_STATUS[order.status] || {
                        label: order.status,
                        tone: "text-muted",
                      };
                      const fulfillment = order.fulfillment;
                      return (
                        <tr key={order.id}>
                          <td>
                            <code style={{ fontSize: 11 }}>{order.orderNo}</code>
                          </td>
                          <td>{order.title}</td>
                          <td>{formatMoney(order.amount)}</td>
                          <td>
                            <span className={status.tone}>{status.label}</span>
                          </td>
                          <td>
                            {order.status === "PAID" && fulfillment?.kind === "card" && fulfillment.card ? (
                              <div className="order-delivery-card">
                                <div>
                                  <span className="order-delivery-label">卡号</span>
                                  <code>{fulfillment.card.cardNo}</code>
                                  <button
                                    type="button"
                                    className="order-copy-btn"
                                    onClick={() => copyText(fulfillment.card!.cardNo)}
                                    aria-label="复制卡号"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <div>
                                  <span className="order-delivery-label">卡密</span>
                                  <code>{fulfillment.card.cardSecret}</code>
                                  <button
                                    type="button"
                                    className="order-copy-btn"
                                    onClick={() => copyText(fulfillment.card!.cardSecret)}
                                    aria-label="复制卡密"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : order.status === "PAID" && fulfillment?.message ? (
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {fulfillment.message}
                                {fulfillment.kind === "membership" && profile?.vipExpireAt ? (
                                  <span style={{ display: "block", color: "var(--teal)", marginTop: 4 }}>
                                    到期 {formatDate(profile.vipExpireAt)}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>{formatDate(order.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="data-panel" style={{ marginTop: 14 }}>
            <div className="data-panel-header">
              <span className="data-panel-title">
                <BookOpen size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                权益说明
              </span>
            </div>
            <div style={{ padding: 18, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 8px" }}>
                · 会员订阅：支付成功后自动延长 VIP 有效期，可阅读全部会员文章。
              </p>
              <p style={{ margin: "0 0 8px" }}>
                · 文章券：仅适用于本站付费文章，兑换后获得 {profile.articleCredits} 篇待使用额度。
              </p>
              <p style={{ margin: "0 0 8px" }}>
                · 外部/通用卡密：来自其他渠道或第三方服务，兑换成功不代表解锁本站内容。
              </p>
              <p style={{ margin: 0 }}>
                · 已解锁 {profile.unlockedPosts} 篇付费文章，注册于 {formatDate(profile.createdAt)}。
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}