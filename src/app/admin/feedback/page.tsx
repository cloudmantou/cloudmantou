"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { feedbackStatusLabels, feedbackStatuses, defaultFeedbackPolicy, type FeedbackItem, type FeedbackStatus } from "@/lib/feedback";
export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]); const [filter, setFilter] = useState(""); const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const [policy, setPolicy] = useState(defaultFeedbackPolicy); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const guard = useRef(false);
  const load = useCallback(async (p = 1) => { setLoading(true); try { const r = await fetch(`/api/admin/feedback?page=${p}&status=${filter}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.message); setItems(j.data.items); setPolicy(j.data.policy); setPage(p); setMore(j.data.hasMore); } finally { setLoading(false); } }, [filter]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function mutate(url: string, body: unknown, success: string) {
    if (guard.current) return; guard.current = true; setBusy(true); setError(""); setMessage("");
    try { const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.message); setMessage(success); await load(page); }
    catch (e) { setError(e instanceof Error ? e.message : "保存失败"); } finally { guard.current = false; setBusy(false); }
  }
  return <div className="feedback-admin">
    <div className="feedback-heading"><div><h2>用户反馈与开发进度</h2><p>审核问题与建议，公开采纳记录，并为贡献者发放积分。</p></div><Link className="feedback-button" href="/admin/points">配置积分兑换卡密 ↗</Link></div>
    <form className="feedback-card feedback-form" onSubmit={e => { e.preventDefault(); void mutate("/api/admin/feedback", policy, "积分规则已保存，只影响尚未发放的奖励。"); }}><h3>积分奖励规则</h3><fieldset disabled={busy}><div className="feedback-form-grid"><label>采纳奖励<input type="number" min={0} max={10000} required value={policy.accepted} onChange={e => setPolicy(p => ({ ...p, accepted: Number(e.target.value) }))} /></label><label>开发完成追加奖励<input type="number" min={0} max={10000} required value={policy.completed} onChange={e => setPolicy(p => ({ ...p, completed: Number(e.target.value) }))} /></label></div><p>同一反馈的每个奖励阶段只发一次；重新打开、重复保存不会重复奖励。奖励发放后不因状态变更收回。</p><button className="feedback-button" disabled={busy}>保存积分规则</button></fieldset></form>
    {error && <p className="feedback-error" role="alert">{error}</p>}{message && <p className="feedback-success" role="status">{message}</p>}
    <label className="feedback-filter">筛选状态<select value={filter} disabled={busy} onChange={e => setFilter(e.target.value)}><option value="">全部反馈</option>{feedbackStatuses.map(s => <option key={s} value={s}>{feedbackStatusLabels[s]}</option>)}</select></label>
    {loading && <p role="status">加载中…</p>}{!loading && !items.length && <p className="feedback-empty">暂无反馈。用户可在任意文章底部提交问题、Bug 和建议。</p>}
    <div className="feedback-list">{items.map(item => <div key={item.id}><FeedbackCard item={item} showPost /><FeedbackDecision key={item.id + item.events.length + String(item.published)} item={item} busy={busy} save={body => mutate(`/api/admin/feedback/${item.id}`, body, "处理进度已更新，符合规则的积分已自动入账。")} /></div>)}</div>
    <div className="feedback-pagination"><button className="feedback-button secondary" disabled={page <= 1 || busy || loading} onClick={() => void load(page - 1).catch(e => setError(e.message))}>上一页</button><span>第 {page} 页</span><button className="feedback-button secondary" disabled={!more || busy || loading} onClick={() => void load(page + 1).catch(e => setError(e.message))}>下一页</button></div>
  </div>;
}
function FeedbackDecision({ item, busy, save }: { item: FeedbackItem; busy: boolean; save: (body: unknown) => Promise<void> }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status); const [published, setPublished] = useState(item.published);
  const [note, setNote] = useState(""); const [version, setVersion] = useState(item.resolvedVersion || "");
  return <form className="feedback-decision feedback-form" onSubmit={e => { e.preventDefault(); void save({ status, published, note, resolvedVersion: version }); }}><fieldset disabled={busy}>
    <div className="feedback-form-grid"><label>处理状态<select value={status} onChange={e => { const value = e.target.value as FeedbackStatus; setStatus(value); if (item.allowPublic && ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(value)) setPublished(true); }}>{feedbackStatuses.map(s => <option key={s} value={s}>{feedbackStatusLabels[s]}</option>)}</select></label><label>解决版本（选填）<input value={version} maxLength={64} onChange={e => setVersion(e.target.value)} placeholder="例如：1.0.6" /></label></div>
    <label>开发者回复 / 更新说明<textarea rows={3} required={status !== item.status} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} placeholder="说明采纳计划、排查情况或解决方法，会显示给用户" /></label>
    <label className="feedback-checkbox"><input type="checkbox" checked={published} disabled={!item.allowPublic} onChange={e => setPublished(e.target.checked)} />{item.allowPublic ? "公开这条反馈、截图与处理进度" : "用户选择了私密反馈，不可公开"}</label>
    <button className="feedback-button" disabled={busy}>{busy ? "保存中…" : "更新进度并发放奖励"}</button>
  </fieldset></form>;
}
