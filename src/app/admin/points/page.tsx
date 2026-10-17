"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PointRewardItem } from "@/components/feedback/PointsCenter";
const types: Record<string, string> = { MANTOU_ADMIN: "Mantou Admin 应用授权", VIP_DAYS: "本站会员（天）", PAID_ARTICLE: "本站文章券（篇）", BALANCE: "本站余额（分）", GENERIC: "外部 / 通用卡密" };
export default function AdminPointsPage() {
  const [items, setItems] = useState<PointRewardItem[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const guard = useRef(false); const [newType, setNewType] = useState("MANTOU_ADMIN");
  const load = useCallback(async () => { const r = await fetch("/api/admin/points/rewards", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.message); setItems(j.data); }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function mutate(url: string, method: string, body: unknown, msg: string) {
    if (guard.current) return false; guard.current = true; setBusy(true); setError(""); setMessage("");
    try { const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.message); await load(); setMessage(msg); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败"); return false; } finally { guard.current = false; setBusy(false); }
  }
  return <div className="feedback-admin"><Link className="feedback-link" href="/admin/feedback">← 反馈与积分规则</Link><h2>积分兑换商品与卡密库存</h2><p>选择卡密来源 → 添加库存 → 设置积分价格并开放兑换。应用授权卡密与原 App 兼容；积分库存与现金销售库存独立。</p>
    {error && <p className="feedback-error" role="alert">{error}</p>}{message && <p className="feedback-success" role="status">{message}</p>}
    <form className="feedback-card feedback-form" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void mutate("/api/admin/points/rewards", "POST", { name: f.get("name"), description: f.get("description"), note: f.get("note"), type: f.get("type"), value: Number(f.get("value")), cost: Number(f.get("cost")) }, "商品已创建，添加库存后即可开放兑换。").then(ok => { if (ok) form.reset(); }); }}><h3>新增兑换商品</h3><fieldset disabled={busy}>
      <div className="feedback-form-grid"><label>商品名称<input name="name" required maxLength={120} placeholder="例如：应用设备授权" /></label><label>兑换积分<input name="cost" type="number" min={1} max={1000000} required defaultValue={100} /></label></div>
      <div className="feedback-form-grid"><label>卡密权益<select name="type" value={newType} onChange={e => setNewType(e.target.value)}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>权益数值<input key={newType} name="value" type="number" min={1} max={100000} required readOnly={newType === "MANTOU_ADMIN"} defaultValue={newType === "MANTOU_ADMIN" ? 1 : 7} /></label></div>
      <label>商品说明<input name="description" required maxLength={500} placeholder="用户能获得什么权益" /></label><label>卡密使用说明<textarea name="note" maxLength={500} rows={2} placeholder="应用授权在 App 内绑定设备；博客权益在账户页核销" /></label><button className="feedback-button" disabled={busy}>创建兑换商品</button>
    </fieldset></form>
    <div className="feedback-list">{items.map(item => <RewardEditor key={`${item.id}:${item.cost}:${item.enabled}:${item.stock}`} item={item} busy={busy} mutate={mutate} />)}</div>{!items.length && <p className="feedback-empty">还没有兑换商品，用户获得的积分会持续保留。</p>}
  </div>;
}
function RewardEditor({ item, busy, mutate }: { item: PointRewardItem; busy: boolean; mutate: (url: string, method: string, body: unknown, message: string) => Promise<boolean> }) {
  const [cost, setCost] = useState(item.cost); const [enabled, setEnabled] = useState(item.enabled); const [count, setCount] = useState(10); const [lines, setLines] = useState("");
  const url = `/api/admin/points/rewards/${item.id}`;
  const appLicense = item.deliverySource === "MANTOU_ADMIN";
  return <article className="feedback-card feedback-form"><h3>{item.name} · {item.enabled ? "已开放" : "未开放"}</h3><p>{item.description}</p><p>{types[appLicense ? "MANTOU_ADMIN" : item.type]} · 数值 {item.value} · 可发库存 {item.stock}</p><fieldset disabled={busy}>
    <form onSubmit={e => { e.preventDefault(); void mutate(url, "PATCH", { action: "update", cost, enabled }, "兑换设置已保存。"); }}><label>积分价格<input type="number" min={1} max={1000000} required value={cost} onChange={e => setCost(Number(e.target.value))} /></label><label className="feedback-checkbox"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />开放给用户兑换</label><button className="feedback-button" disabled={busy}>保存兑换设置</button></form>
    <form onSubmit={e => { e.preventDefault(); void mutate(url, "PATCH", { action: "stock", count, ...(lines.trim() ? { importLines: lines.trim().split(/\r?\n/).filter(Boolean) } : {}) }, "卡密库存已添加。"); }}><h4>添加卡密库存</h4>{(appLicense || item.type !== "GENERIC") && <label>生成数量（1–30）<input type="number" value={count} min={1} max={30} required onChange={e => setCount(Number(e.target.value))} /></label>}
      <label>{appLicense ? "或导入 Mantou Admin 未使用的卡密（选填）" : item.type === "GENERIC" ? "导入实际可用的外部卡密" : "或导入已有卡密（选填）"}<textarea rows={3} required={item.type === "GENERIC" && !appLicense} value={lines} onChange={e => setLines(e.target.value)} placeholder={appLicense ? "每行一个已有应用授权卡密，最多 30 行" : "每行：卡号,卡密，最多 30 行"} /></label><p>只保存加密卡密；发卡记录可在原订单和卡密管理中查看。</p><button className="feedback-button secondary" disabled={busy}>{lines.trim() || (item.type === "GENERIC" && !appLicense) ? "导入卡密" : appLicense ? "生成应用授权卡密" : "生成积分专属卡密"}</button>
    </form>
  </fieldset></article>;
}
