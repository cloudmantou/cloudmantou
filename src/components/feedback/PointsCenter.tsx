"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FeedbackCard } from "./FeedbackCard";
import type { FeedbackItem } from "@/lib/feedback";
export type PointRewardItem = { id: string; name: string; description: string; note: string | null; cost: number; stock: number; enabled: boolean; type: string; value: number; deliverySource?: string };
type Receipt = { id: string; name: string; cost: number; note: string | null; createdAt: string; card: { cardNo: string; cardSecret: string; deliverySource?: string } | null };
type PointsData = { points: number; ledger: { id: string; delta: number; reason: string; balanceAfter: number; createdAt: string }[]; redemptions: Receipt[]; feedbacks: FeedbackItem[]; policy: { accepted: number; completed: number }; page: number; hasMore: boolean };
export function PointsCenter() {
  const [data, setData] = useState<PointsData | null>(null); const [rewards, setRewards] = useState<PointRewardItem[]>([]);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const requests = useRef<Record<string, string>>({}); const guard = useRef(false);
  const load = useCallback(async (page = 1) => {
    const [r, s] = await Promise.all([fetch(`/api/user/points?page=${page}`, { cache: "no-store" }), fetch("/api/points/rewards", { cache: "no-store" })]);
    const [j, k] = await Promise.all([r.json(), s.json()]); if (!r.ok || !s.ok) throw new Error(j.message || k.message);
    setData(prev => page > 1 && prev ? { ...j.data, ledger: [...prev.ledger, ...j.data.ledger] } : j.data); setRewards(k.data);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function redeem(id: string) {
    if (guard.current) return; guard.current = true; setBusy(true); setError(""); setMessage("");
    // Persist until the server confirms success, so retrying a lost response cannot double debit.
    const key = requests.current[id] ||= crypto.randomUUID();
    try {
      const r = await fetch("/api/points/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId: id, requestKey: key }) }); const j = await r.json(); if (!r.ok) throw new Error(j.message);
      delete requests.current[id]; setMessage("兑换成功，卡号和卡密已保存在下方的兑换记录中。"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "兑换失败"); } finally { guard.current = false; setBusy(false); }
  }
  return <div className="feedback-center"><Link className="feedback-link" href="/dashboard">← 账户与权益</Link><p className="feedback-eyebrow">贡献获得回报</p><h1>我的反馈与积分</h1>
    {error && <p className="feedback-error" role="alert">{error}</p>}{message && <p className="feedback-success" role="status">{message}</p>}
    {!data ? <p>正在加载积分…</p> : <>
      <section className="feedback-balance"><span>可用积分</span><strong>{data.points}</strong><p>反馈被采纳 +{data.policy.accepted}，开发完成再 +{data.policy.completed}。提交本身不增加积分。</p></section>
      <section><h2>积分兑换卡密</h2><p className="feedback-muted">兑换将扣除积分并发放卡号和卡密。应用授权卡密在 App 内绑定设备；博客权益在账户页核销；外部卡密按商品说明使用。</p><div className="feedback-reward-grid">{rewards.map(r => <article className="feedback-card" key={r.id}><h3>{r.name}</h3><p>{r.description}</p><p className="feedback-points">{r.cost} 积分 · 剩余 {r.stock} 份</p>{r.note && <p className="feedback-muted">{r.note}</p>}<button className="feedback-button" disabled={busy || data.points < r.cost || !r.stock} onClick={() => void redeem(r.id)}>{!r.stock ? "库存不足" : data.points < r.cost ? "积分不足" : `花 ${r.cost} 积分兑换`}</button></article>)}</div>{!rewards.length && <p className="feedback-empty">管理员还未开放兑换商品。积分会保留在账户中，开放后即可兑换。</p>}</section>
      <section><h2>我的兑换记录</h2>{data.redemptions.map(r => <article className="feedback-card" key={r.id}><h3>{r.name}</h3><p>{new Date(r.createdAt).toLocaleString("zh-CN")} · {r.cost} 积分</p>{r.card && <div className="feedback-receipt"><p>卡号：<code>{r.card.cardNo}</code></p><p>卡密：<code>{r.card.cardSecret}</code></p>{r.card.deliverySource === "MANTOU_ADMIN" ? <p>请在 App 内输入卡密绑定设备，无需在博客核销。</p> : <Link className="feedback-link" href="/dashboard#redeem">前往账户核销 ↗</Link>}</div>}{r.note && <p>{r.note}</p>}</article>)}{!data.redemptions.length && <p className="feedback-muted">暂无兑换记录。</p>}</section>
      <section><h2>积分明细</h2><div className="feedback-ledger">{data.ledger.map(e => <div key={e.id}><span>{e.reason}<small>{new Date(e.createdAt).toLocaleString("zh-CN")}</small></span><strong>{e.delta > 0 ? "+" : ""}{e.delta}</strong><span>余额 {e.balanceAfter}</span></div>)}</div>{!data.ledger.length && <p className="feedback-muted">暂无积分变动。</p>}{data.hasMore && <button disabled={busy} className="feedback-button secondary" onClick={() => void load(data.page + 1).catch(e => setError(e.message))}>更多明细</button>}</section>
      <section><h2>我的反馈</h2><div className="feedback-list">{data.feedbacks.map(f => <FeedbackCard item={f} key={f.id} showPost />)}</div>{!data.feedbacks.length && <p className="feedback-muted">在应用介绍文章底部提交问题或建议，即可在这里跟进进度。</p>}</section>
    </>}
  </div>;
}
