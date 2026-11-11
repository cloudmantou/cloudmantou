"use client";
import { useEffect, useState } from "react";
import type { LoginServerCatalog } from "@/lib/assistant-catalog";
export default function LoginServerEditor() {
  const [catalog, setCatalog] = useState<LoginServerCatalog | null>(null);
  const [message, setMessage] = useState(""); const [working, setWorking] = useState(false);
  async function load() {
    setWorking(true);
    try { const r = await fetch("/api/admin/assistant-services/servers", { cache: "no-store" }); const b = await r.json(); if (!r.ok) throw new Error(b.message); setCatalog(b.data); setMessage(""); }
    catch (e) { setMessage(e instanceof Error ? e.message : "读取失败"); } finally { setWorking(false); }
  }
  useEffect(() => { void load(); }, []);
  async function publish() {
    setWorking(true);
    try { const r = await fetch("/api/admin/assistant-services/servers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catalog) }); const b = await r.json(); if (!r.ok) throw new Error(b.message); setCatalog(b.data); setMessage("已发布。新版 App 在添加账号或重新登录、打开登录页时请求一次最新列表；也可手动刷新。"); }
    catch (e) { setMessage(e instanceof Error ? e.message : "发布失败"); } finally { setWorking(false); }
  }
  function update(index: number, patch: Partial<LoginServerCatalog["servers"][number]>) { setCatalog(c => c ? { ...c, servers: c.servers.map((s, i) => i === index ? { ...s, ...patch } : s) } : c); }
  const input = "w-full rounded border px-3 py-2 bg-white text-gray-900";
  return <section className="rounded-xl border bg-white p-5 text-gray-900 space-y-4">
    <div><h2 className="text-lg font-semibold">Apple ID 登录服务器</h2><p className="text-sm text-gray-500">配置名称、地址和排序，保存后发布给 App。这里只分发服务器信息，不包含 Apple ID、密码或登录会话。登录节点与下载账号独立。</p></div>
    {message && <p role="status" className="rounded bg-gray-100 p-3 text-sm">{message}</p>}
    <fieldset disabled={working} className="space-y-4 disabled:opacity-60">{catalog?.servers.map((s, i) => <div key={s.id} className="rounded-lg border p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-3"><label className="text-sm">显示名称<input aria-label={`服务器 ${i + 1} 名称`} className={input} value={s.name} maxLength={60} onChange={e => update(i, { name: e.target.value })} /></label><label className="text-sm">服务器地址<input className={input} value={s.apiBase} placeholder="https://example.com/v3" onChange={e => update(i, { apiBase: e.target.value, ...(s.sourceBase === s.apiBase ? { sourceBase: e.target.value } : {}) })} /></label><label className="text-sm">Anisette 地址<input className={input} value={s.sourceBase} onChange={e => update(i, { sourceBase: e.target.value })} /></label></div>
      <div className="flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">说明<input className={input} value={s.description} maxLength={160} onChange={e => update(i, { description: e.target.value })} /></label><label className="text-sm">排序<input className="block w-20 rounded border px-2 py-2" type="number" min={0} max={999} value={s.sortOrder} onChange={e => update(i, { sortOrder: Number(e.target.value) })} /></label><label><input type="checkbox" checked={s.enabled} onChange={e => update(i, { enabled: e.target.checked })} /> 启用</label><label><input type="checkbox" checked={s.isHidden} onChange={e => update(i, { isHidden: e.target.checked })} /> 隐藏地址显示</label><button className="rounded border px-3 py-2 text-red-700" onClick={() => setCatalog(c => c ? { ...c, servers: c.servers.filter((_, n) => n !== i) } : c)}>移除</button></div>
    </div>)}</fieldset>
    <div className="flex flex-wrap gap-3"><button disabled={!catalog || working || catalog.servers.length >= 32} className="rounded border px-3 py-2" onClick={() => setCatalog(c => c ? { ...c, servers: [...c.servers, { id: crypto.randomUUID(), name: "新服务器", apiBase: "", sourceBase: "", description: "", enabled: true, isHidden: false, sortOrder: Math.min(999, c.servers.length * 10) }] } : c)}>添加服务器</button><button disabled={!catalog || working} className="rounded bg-gray-900 text-white px-4 py-2" onClick={() => void publish()}>保存并发布</button><button disabled={working} className="rounded border px-3 py-2" onClick={() => void load()}>重新加载</button><a className="rounded border px-3 py-2" href="/api/assistant/servers?format=sidestore" target="_blank" rel="noreferrer">查看 SideStore JSON</a></div>
    <p className="text-xs text-gray-500">地址隐藏只影响界面显示。旧 App 仍可读取兼容列表；名称和自动刷新改进需新版 App。</p>
  </section>;
}
