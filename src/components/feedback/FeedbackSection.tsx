"use client";
/* eslint-disable @next/next/no-img-element -- Private screenshot previews need the browser's authenticated request. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FeedbackCard } from "./FeedbackCard";
import { feedbackKindLabels, feedbackKinds, defaultFeedbackPolicy, type FeedbackItem } from "@/lib/feedback";
export function FeedbackSection({ slug }: { slug: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const [items, setItems] = useState<FeedbackItem[]>([]); const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const [policy, setPolicy] = useState(defaultFeedbackPolicy); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const guard = useRef(false);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]); const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const load = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try { const r = await fetch(`/api/posts/${encodeURIComponent(slug)}/feedback?page=${p}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.message); setItems(prev => append ? [...prev, ...j.data.items] : j.data.items); setPage(p); setMore(j.data.hasMore); setPolicy(j.data.policy); }
    catch (e) { setError(e instanceof Error ? e.message : "加载反馈失败"); }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { if (sessionStatus !== "loading") void load(1); }, [load, sessionStatus, session?.user?.id]);
  async function upload(files: FileList | null) {
    if (!files?.length || uploading || busy) return;
    if (files.length + images.length > 3) { setError("每条反馈最多 3 张截图"); return; }
    setUploading(true); setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 4 * 1024 * 1024) throw new Error("每张截图不能超过 4 MB");
        const form = new FormData(); form.set("file", file);
        const r = await fetch("/api/feedback/images", { method: "POST", body: form }); const j = await r.json(); if (!r.ok) throw new Error(j.message);
        setImages(prev => [...prev, j.data]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "截图上传失败"); } finally { setUploading(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (guard.current || uploading) return; guard.current = true; setBusy(true); setError(""); setMessage("");
    const fd = new FormData(event.currentTarget);
    try {
      const r = await fetch(`/api/posts/${encodeURIComponent(slug)}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: fd.get("kind"), title: fd.get("title"), content: fd.get("content"), appVersion: fd.get("appVersion"), environment: fd.get("environment"), imageIds: images.map(i => i.id), allowPublic: fd.get("allowPublic") === "on" }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.message);
      formRef.current?.reset(); setImages([]); setMessage("反馈已提交。你可以在这里和积分中心查看处理进度。"); await load(1);
    } catch (e) { setError(e instanceof Error ? e.message : "提交失败"); } finally { guard.current = false; setBusy(false); }
  }
  return <section className="feedback-section" id="feedback" aria-labelledby="feedback-heading">
    <div className="feedback-heading"><div><p className="feedback-eyebrow">一起改进应用</p><h2 id="feedback-heading">问题与功能建议</h2><p>记录问题、提交 Bug 或分享新想法，开发者的处理进度会显示在这里。</p></div><Link className="feedback-button secondary" href="/dashboard/points">我的反馈与积分 ↗</Link></div>
    <p className="feedback-reward-hint">被采纳 +{policy.accepted} 积分，开发完成再 +{policy.completed} 积分。积分可兑换管理员开放的卡密商品。</p>
    {sessionStatus === "loading" ? <p>正在确认登录状态…</p> : session?.user ? <form ref={formRef} onSubmit={submit} className="feedback-form">
      <fieldset disabled={busy || uploading}><div className="feedback-form-grid"><label>反馈类型<select name="kind" defaultValue="BUG">{feedbackKinds.map(k => <option key={k} value={k}>{feedbackKindLabels[k]}</option>)}</select></label><label>应用版本（选填）<input name="appVersion" maxLength={64} placeholder="例如：1.0.5" /></label></div>
        <label>标题<input name="title" required minLength={3} maxLength={150} placeholder="用一句话描述问题或建议" /></label>
        <label>详细描述<textarea name="content" required minLength={5} maxLength={5000} rows={5} placeholder="发生了什么？如何复现？你希望有什么改进？" /></label>
        <label>设备与系统（选填）<input name="environment" maxLength={300} placeholder="例如：iPhone 15 / iOS 18" /></label>
        <label>添加截图（最多 3 张，每张 4 MB）<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={e => { void upload(e.target.files); e.target.value = ""; }} /></label>
        <p className="feedback-muted">截图请先遮挡密码、卡密和个人信息。图片会压缩保存，审核前仅本人和管理员可见。</p>
        <div className="feedback-images">{images.map((im, i) => <div key={im.id}><img src={im.url} alt={`待提交截图 ${i + 1}`} /><button type="button" onClick={() => setImages(prev => prev.filter(x => x.id !== im.id))}>移除截图 {i + 1}</button></div>)}</div>
        <label className="feedback-checkbox"><input type="checkbox" name="allowPublic" defaultChecked />允许管理员审核后公开这条反馈及截图；取消则保持私密</label>
        <button className="feedback-button" disabled={busy || uploading}>{busy ? "提交中…" : uploading ? "上传截图中…" : "提交反馈"}</button>
      </fieldset>
    </form> : <p className="feedback-login"><Link href={`/login?callbackUrl=${encodeURIComponent(`/post/${slug}#feedback`)}`}>登录后提交反馈</Link>，让你的建议和奖励归属到自己的账户。</p>}
    {error && <p role="alert" className="feedback-error">{error}</p>}{message && <p role="status" className="feedback-success">{message}</p>}
    <div className="feedback-list">{items.map(item => <FeedbackCard key={item.id} item={item} />)}</div>
    {loading && <p role="status">正在加载反馈…</p>}{!loading && !items.length && <p className="feedback-empty">还没有公开的反馈。遇到问题或有新想法，欢迎留下第一条。</p>}
    {more && <button className="feedback-button secondary" disabled={loading} onClick={() => void load(page + 1, true)}>查看更多反馈</button>}
  </section>;
}
