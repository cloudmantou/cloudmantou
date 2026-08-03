"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage, localizeOfficialPath } from "@/i18n/official";
import { PaymentCheckout, type CheckoutOrder } from "@/components/payment/PaymentCheckout";

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

const panelStyle = {
  border: "3px solid var(--ed-ink)",
  background: "var(--ed-paper-strong)",
  boxShadow: "6px 6px 0 var(--ed-ink)",
} as const;

function AccountMetric({ label, value, detail, accent = "var(--ed-blue)" }: { label: string; value: string | number; detail: string; accent?: string }) {
  return (
    <article style={{ ...panelStyle, minHeight: 146, padding: 19 }}>
      <p style={{ margin: 0, color: "var(--ed-muted)", fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</p>
      <strong style={{ display: "block", color: accent, fontSize: "clamp(1.2rem, 2.4vw, 1.8rem)", fontWeight: 950, letterSpacing: "-.04em", marginTop: 17, overflowWrap: "anywhere" }}>{value}</strong>
      <small style={{ display: "block", color: "var(--ed-muted)", fontSize: 12, fontWeight: 650, lineHeight: 1.55, marginTop: 8 }}>{detail}</small>
    </article>
  );
}

export function UserDashboard() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.account;
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
  const [error, setError] = useState<string | null>(null);
  const [resumeOrder, setResumeOrder] = useState<CheckoutOrder | null>(null);

  const money = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    style: "currency", currency: "CNY", currencyDisplay: "narrowSymbol",
  }), [locale]);
  const date = useMemo(() => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }), [locale]);
  const shortDate = useMemo(() => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric", month: "short", day: "numeric",
  }), [locale]);
  const formatDate = (value: string | null, compact = false) => value ? (compact ? shortDate : date).format(new Date(value)) : copy.none;

  const loadProfile = useCallback(async () => {
    const response = await fetch("/api/user/profile");
    const data = await response.json();
    if (!response.ok) throw new Error("profile");
    setProfile(data.data);
  }, []);
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await fetch("/api/orders?pageSize=10");
      const data = await response.json();
      if (!response.ok) throw new Error("orders");
      setOrders(Array.isArray(data.data) ? data.data : []);
    } catch {
      setOrders([]);
      setOrdersError(copy.loadOrdersFailed);
    } finally {
      setOrdersLoading(false);
    }
  }, [copy.loadOrdersFailed]);

  useEffect(() => {
    void loadProfile().catch(() => setError(copy.loading)).finally(() => setLoading(false));
    void loadOrders();
  }, [copy.loading, loadOrders, loadProfile]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#orders" && searchParams.get("paid") !== "1") return;
    window.requestAnimationFrame(() => document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [searchParams]);

  const redeem = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setRedeeming(true);
    try {
      const response = await fetch("/api/cards/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNo: cardNo.trim(), cardSecret: cardSecret.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("redeem");
      setMessage(data.data?.benefit?.message || copy.redeemed);
      setCardNo("");
      setCardSecret("");
      await Promise.all([loadProfile(), loadOrders()]);
    } catch {
      setError(copy.redeemHint);
    } finally {
      setRedeeming(false);
    }
  };

  const copyText = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch { /* browser feedback is intentionally non-blocking */ } };
  const orderStatus = (status: string) => copy.orderStatus[status as keyof typeof copy.orderStatus] || status;
  const orderTitle = (order: OrderItem) => {
    const translated = copy.productTypes[order.productType as keyof typeof copy.productTypes];
    return locale === "en" && translated ? translated : order.title;
  };
  const fulfillmentLabel = (order: OrderItem) => {
    if (order.fulfillment?.kind === "membership") return copy.membershipBenefit;
    if (order.fulfillment?.kind === "article") return copy.productTypes.PAID_POST;
    return order.fulfillment?.message || copy.none;
  };
  const displayName = profile?.nickname || profile?.username || copy.account;

  return (
    <div className="editorial-account-page" style={{ color: "var(--ed-ink)" }}>
      <section style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
        <div>
          <p style={{ color: "var(--ed-blue)", fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 850, letterSpacing: ".08em", margin: 0 }}>{copy.eyebrow}</p>
          <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 5.5rem)", fontWeight: 950, letterSpacing: "-.08em", lineHeight: ".9", margin: "10px 0 0" }}>{copy.title}</h1>
          <p style={{ color: "var(--ed-muted)", fontWeight: 650, lineHeight: 1.7, margin: "18px 0 0", maxWidth: 650 }}>{copy.description}</p>
        </div>
        {!loading && profile ? <aside style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 12, maxWidth: 330, padding: 16 }}><Crown color={profile.vipActive ? "var(--ed-yellow)" : "var(--ed-muted)"} /><span><strong style={{ display: "block", fontWeight: 950 }}>{profile.vipActive ? copy.activeMember : copy.inactiveMember}</strong><small style={{ color: "var(--ed-muted)", fontWeight: 650 }}>{profile.vipActive && profile.vipExpireAt ? interpolateMessage(copy.expiresOn, { date: formatDate(profile.vipExpireAt, true) }) : copy.memberPrompt}</small></span></aside> : null}
      </section>

      {loading ? <p style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 9, padding: 18 }}><Loader2 size={17} className="animate-spin" />{copy.loading}</p> : null}
      {error && !loading ? <p role="alert" style={{ borderLeft: "7px solid var(--ed-red)", background: "#fff0ed", color: "#8d2118", fontWeight: 750, padding: 15 }}>{error}</p> : null}

      {profile ? <>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 18, marginBottom: 28 }}>
          <AccountMetric label={copy.account} value={displayName} detail={profile.email} accent="var(--ed-blue)" />
          <AccountMetric label={copy.membership} value={profile.vipActive ? `VIP ${profile.vipLevel}` : copy.notActivated} detail={profile.vipExpireAt ? formatDate(profile.vipExpireAt) : copy.noExpiry} accent={profile.vipActive ? "var(--ed-blue)" : "var(--ed-muted)"} />
          <AccountMetric label={copy.articleCredits} value={profile.articleCredits} detail={copy.articleCreditsHint} accent="var(--ed-red)" />
          <AccountMetric label={copy.unlockedPosts} value={profile.unlockedPosts} detail={interpolateMessage(copy.orderCount, { count: profile.orderCount })} accent="var(--ed-yellow)" />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
          <article style={{ ...panelStyle, padding: 22 }}>
            <h2 style={{ alignItems: "center", display: "flex", gap: 8, fontSize: 18, fontWeight: 950, margin: 0 }}><KeyRound size={18} />{copy.redeem}</h2>
            <p style={{ color: "var(--ed-muted)", fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 800, margin: "7px 0 0" }}>{copy.redeemMeta}</p>
            <form onSubmit={redeem} style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 850 }}>{copy.cardNumber}<input value={cardNo} onChange={(event) => setCardNo(event.target.value)} required autoComplete="off" style={{ border: "2px solid var(--ed-ink)", borderRadius: 0, padding: "10px 11px" }} /></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 850 }}>{copy.cardSecret}<input value={cardSecret} onChange={(event) => setCardSecret(event.target.value)} required autoComplete="off" style={{ border: "2px solid var(--ed-ink)", borderRadius: 0, padding: "10px 11px" }} /></label>
              <button type="submit" disabled={redeeming} style={{ minHeight: 41, border: "2px solid var(--ed-ink)", borderRadius: 0, background: "var(--ed-blue)", boxShadow: "3px 3px 0 var(--ed-ink)", color: "#fff", cursor: redeeming ? "wait" : "pointer", fontWeight: 900 }}>{redeeming ? copy.redeeming : copy.redeemNow}</button>
            </form>
            <p style={{ color: message ? "#08745e" : "var(--ed-muted)", fontSize: 12, fontWeight: 650, lineHeight: 1.65, margin: "16px 0 0" }}>{message || copy.redeemHint}</p>
          </article>
          <article style={{ ...panelStyle, padding: 22 }}>
            <h2 style={{ alignItems: "center", display: "flex", gap: 8, fontSize: 18, fontWeight: 950, margin: 0 }}><Wallet size={18} />{copy.balance}</h2>
            <strong style={{ color: "var(--ed-blue)", display: "block", fontSize: "2.3rem", fontWeight: 950, marginTop: 28 }}>{money.format(Number(profile.balance) / 100)}</strong>
            <p style={{ color: "var(--ed-muted)", fontSize: 13, fontWeight: 650, lineHeight: 1.7, margin: "14px 0 0" }}>{copy.balanceHint}</p>
            <Link href={localizeOfficialPath("/pricing", locale)} style={{ alignItems: "center", background: "var(--ed-yellow)", border: "2px solid var(--ed-ink)", boxShadow: "3px 3px 0 var(--ed-ink)", color: "var(--ed-ink)", display: "inline-flex", fontSize: 12, fontWeight: 900, gap: 7, marginTop: 20, padding: "10px 12px" }}><CreditCard size={14} />{copy.buyMembership}</Link>
          </article>
        </section>

        <section id="orders" style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ alignItems: "center", borderBottom: "2px solid var(--ed-ink)", display: "flex", justifyContent: "space-between", gap: 16, padding: "18px 21px" }}><h2 style={{ alignItems: "center", display: "flex", gap: 8, fontSize: 18, fontWeight: 950, margin: 0 }}><Receipt size={18} />{copy.orderHistory}</h2><span style={{ color: "var(--ed-muted)", fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 800 }}>{copy.recentOrders}</span></div>
          {searchParams.get("paid") === "1" ? <p style={{ background: "#e9fff8", borderBottom: "2px solid var(--ed-ink)", color: "#08745e", fontWeight: 750, margin: 0, padding: "13px 21px" }}><Sparkles size={14} style={{ display: "inline", marginRight: 6 }} />{copy.paidNotice}</p> : null}
          {ordersLoading ? <p style={{ color: "var(--ed-muted)", fontWeight: 700, margin: 0, padding: 22 }}>{copy.loadingOrders}</p> : null}
          {ordersError ? <div style={{ color: "var(--ed-red)", padding: 22 }}><p>{ordersError}</p><button type="button" onClick={() => void loadOrders()} style={{ border: "2px solid var(--ed-ink)", background: "var(--ed-yellow)", fontWeight: 900, padding: "8px 11px" }}>{copy.retry}</button></div> : null}
          {!ordersLoading && !ordersError && orders.length === 0 ? <p style={{ color: "var(--ed-muted)", fontWeight: 700, margin: 0, padding: 22 }}>{copy.emptyOrders}</p> : null}
          {!ordersLoading && !ordersError && orders.length > 0 ? <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}><thead><tr>{[copy.orderNumber, copy.product, copy.amount, copy.status, copy.delivery, copy.time].map((label) => <th key={label} style={{ borderBottom: "2px solid var(--ed-ink)", fontFamily: '"DM Mono", monospace', fontSize: 11, padding: "13px 14px", textAlign: "left" }}>{label}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td style={{ borderBottom: "1px solid #b5bec5", fontFamily: '"DM Mono", monospace', fontSize: 11, padding: 14 }}>{order.orderNo}</td><td style={{ borderBottom: "1px solid #b5bec5", fontWeight: 750, padding: 14 }}>{orderTitle(order)}</td><td style={{ borderBottom: "1px solid #b5bec5", padding: 14 }}>{money.format(order.amount)}</td><td style={{ borderBottom: "1px solid #b5bec5", color: order.status === "PAID" ? "#08745e" : "var(--ed-muted)", fontWeight: 850, padding: 14 }}>{orderStatus(order.status)}</td><td style={{ borderBottom: "1px solid #b5bec5", fontSize: 12, padding: 14 }}>{order.status === "PAID" && order.fulfillment?.kind === "card" && order.fulfillment.card ? <div style={{ display: "grid", gap: 6 }}><span>{copy.cardNumber}: <code>{order.fulfillment.card.cardNo}</code><button type="button" aria-label={copy.copyCardNumber} onClick={() => void copyText(order.fulfillment!.card!.cardNo)} style={{ border: 0, background: "transparent", color: "var(--ed-blue)", marginLeft: 6 }}><Copy size={13} /></button></span><span>{copy.cardSecret}: <code>{order.fulfillment.card.cardSecret}</code><button type="button" aria-label={copy.copyCardSecret} onClick={() => void copyText(order.fulfillment!.card!.cardSecret)} style={{ border: 0, background: "transparent", color: "var(--ed-blue)", marginLeft: 6 }}><Copy size={13} /></button></span></div> : order.status === "PENDING" ? <button type="button" onClick={() => setResumeOrder({ id: order.id, orderNo: order.orderNo, title: orderTitle(order), amount: order.amount })} style={{ border: "2px solid var(--ed-ink)", background: "var(--ed-yellow)", boxShadow: "2px 2px 0 var(--ed-ink)", fontSize: 11, fontWeight: 900, padding: "7px 9px" }}>{copy.continuePayment}</button> : fulfillmentLabel(order)}</td><td style={{ borderBottom: "1px solid #b5bec5", fontSize: 12, padding: 14 }}>{formatDate(order.createdAt)}</td></tr>)}</tbody></table></div> : null}
        </section>

        <PaymentCheckout
          order={resumeOrder}
          open={resumeOrder !== null}
          onClose={() => setResumeOrder(null)}
          onPaid={() => { void Promise.all([loadProfile(), loadOrders()]); }}
          returnPath={localizeOfficialPath("/dashboard?paid=1#orders", locale)}
        />

        <section style={{ ...panelStyle, marginTop: 20, padding: 22 }}><h2 style={{ alignItems: "center", display: "flex", gap: 8, fontSize: 18, fontWeight: 950, margin: 0 }}><BookOpen size={18} />{copy.fulfillment}</h2><div style={{ color: "var(--ed-muted)", fontSize: 13, fontWeight: 650, lineHeight: 1.75, marginTop: 15 }}><p>{copy.membershipBenefit}</p><p>{interpolateMessage(copy.creditBenefit, { count: profile.articleCredits })}</p><p>{copy.externalCardBenefit}</p><p>{interpolateMessage(copy.unlockedBenefit, { count: profile.unlockedPosts, date: formatDate(profile.createdAt, true) })}</p></div></section>
      </> : null}
    </div>
  );
}
