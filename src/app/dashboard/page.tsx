"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, CreditCard, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { products } from "@/data/mock";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [cardNo, setCardNo] = useState("");
  const [cardSecret, setCardSecret] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const handleRedeem = async () => {
    if (!cardNo.trim() || !cardSecret.trim()) return;
    setRedeemLoading(true);
    setRedeemMsg("");
    try {
      const res = await fetch("/api/cards/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNo: cardNo.trim(), cardSecret: cardSecret.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemMsg(`兑换成功: ${data.data?.benefit?.description || "已到账"}`);
        setCardNo("");
        setCardSecret("");
      } else {
        setRedeemMsg(data.message || "兑换失败");
      }
    } catch {
      setRedeemMsg("网络错误");
    }
    setRedeemLoading(false);
  };

  return (
    <main className="standalone-page">
      <div className="standalone-shell">
        <Link className="ghost-button inline-link" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          返回首页
        </Link>

        <section className="dashboard-hero">
          <div>
            <p className="home-greeting">Member Center</p>
            <h1 className="page-title">会员中心</h1>
            <p className="page-desc">
              {session?.user
                ? `欢迎回来，${session.user.nickname || session.user.username || session.user.name || session.user.email || "用户"}`
                : "登录后管理你的会员权益。"}
            </p>
          </div>
          <div className="vip-panel">
            <ShieldCheck size={24} aria-hidden="true" />
            <div>
              <strong>{session?.user?.nickname || session?.user?.username || session?.user?.name || "未登录"}</strong>
              <span>{session?.user?.role === "ADMIN" ? "管理员 · 全站权限" : "普通会员"}</span>
            </div>
          </div>
        </section>

        {/* Profile section */}
        <section className="work-grid">
          <article className="workspace-panel">
            <UserRound size={20} aria-hidden="true" />
            <h2>个人资料</h2>
            <p>{session?.user?.email || "请先登录"}</p>
          </article>
          <article className="workspace-panel">
            <CreditCard size={20} aria-hidden="true" />
            <h2>我的订单</h2>
            <p>查看待支付、已支付和已交付订单。</p>
          </article>
          <article className="workspace-panel">
            <KeyRound size={20} aria-hidden="true" />
            <h2>卡密兑换</h2>
            <p>输入卡号和卡密，兑换会员天数或余额。</p>
          </article>
        </section>

        {/* Card redemption */}
        <section className="section-block">
          <h2 className="section-title">卡密兑换</h2>
          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: 10,
                alignItems: "stretch",
              }}
              className="dashboard-redeem-row"
            >
              <input
                type="text"
                value={cardNo}
                onChange={(e) => setCardNo(e.target.value)}
                placeholder="卡号"
                aria-label="卡号"
                className="px-3 py-2 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
              />
              <input
                type="text"
                value={cardSecret}
                onChange={(e) => setCardSecret(e.target.value)}
                placeholder="卡密"
                aria-label="卡密"
                className="px-3 py-2 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
              />
              <button
                type="button"
                onClick={handleRedeem}
                disabled={redeemLoading || !cardNo.trim() || !cardSecret.trim()}
                className="px-5 py-2 text-xs rounded-md transition-colors"
                style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace', opacity: redeemLoading ? 0.7 : 1, whiteSpace: "nowrap" }}
              >
                {redeemLoading ? "兑换中..." : "兑换"}
              </button>
            </div>
            {redeemMsg && (
              <div
                className="text-xs"
                style={{ color: redeemMsg.includes("成功") ? "var(--teal)" : "var(--rose)", fontFamily: '"JetBrains Mono", monospace' }}
              >
                {redeemMsg}
              </div>
            )}
          </div>
        </section>

        {/* Products list */}
        <section className="section-block">
          <h2 className="section-title">可购买权益</h2>
          <div className="compact-product-list">
            {products.slice(0, 3).map((product) => (
              <div className="compact-row" key={product.id}>
                <span>{product.name}</span>
                <strong>{product.price}</strong>
                <em>库存 {product.stock}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
