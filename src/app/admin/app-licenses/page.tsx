"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Download, KeyRound, RefreshCw, Search, Smartphone } from "lucide-react";
import type { LicenseMutation } from "@/lib/app-licenses";

type Tab = "apps" | "cards" | "bindings";
type Row = { id: string | number; name?: string; version?: string; identifier?: string; plist?: string; pkg?: string; requires_key?: number; card_key?: string; used?: number; udid?: string; binding_count?: number; created_at?: string; expires_in?: number | null };
type Data = { stats: { apps: number; cards: number; available: number; bindings: number }; rows: Row[]; total: number; page: number; pageSize: number; bindingTtlDays: number };
type AppForm = { id: string; name: string; version: string; identifier: string; plist: string; pkg: string; requiresKey: boolean };
const blankApp: AppForm = { id: "", name: "", version: "", identifier: "", plist: "", pkg: "", requiresKey: true };
const labels: Record<Tab, string> = { apps: "应用管理", cards: "授权卡密", bindings: "设备绑定" };
const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";
const buttonClass = "whitespace-nowrap rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40";
const MAX_BATCH_UNBIND = 100;

function expiryLabel(row: Row, ttlDays: number) {
  if (!ttlDays || row.expires_in == null || !row.created_at) return { date: "不自动解除", left: "" };
  const date = new Date(new Date(row.created_at).getTime() + ttlDays * 86400000).toLocaleDateString("zh-CN");
  if (row.expires_in <= 0) return { date, left: "已到期，等待自动解除" };
  return { date, left: `剩余 ${Math.ceil(row.expires_in / 86400)} 天` };
}

export default function AppLicensesPage() {
  const [tab, setTab] = useState<Tab>("apps");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [app, setApp] = useState<AppForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(10);
  const [imports, setImports] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [udid, setUdid] = useState("");
  const [cardKey, setCardKey] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ttlInput, setTtlInput] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null); setSelected(new Set());
    const params = new URLSearchParams({ tab, page: String(page), search, status });
    fetch(`/api/admin/app-licenses?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok || body.code !== 0) throw new Error(body.message || "加载失败"); return body.data as Data; })
      .then(result => { if (!controller.signal.aborted) { setData(result); setTtlInput(String(result.bindingTtlDays)); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "加载失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, page, search, status, revision]);

  const mutate = useCallback(async (payload: LicenseMutation) => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/app-licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok || body.code !== 0) throw new Error(body.message || "操作失败");
      setNotice(body.data.message);
      if (Array.isArray(body.data.cards)) setGenerated(body.data.cards);
      setRevision(v => v + 1); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败，请稍后重试"); return false; }
    finally { inFlight.current = false; setBusy(false); }
  }, []);

  function changeTab(next: Tab) { setTab(next); setPage(1); setSearch(""); setSearchInput(""); setApp(null); setError(""); setNotice(""); }
  function searchRows(event: FormEvent) { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }
  function downloadCards() {
    const url = URL.createObjectURL(new Blob([generated.join("\n")], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `应用授权卡密-${new Date().toISOString().slice(0, 10)}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }
  const disabled = busy || loading;
  const ttlDays = data?.bindingTtlDays ?? 0;
  const pageIds = tab === "bindings" && data ? data.rows.map(row => Number(row.id)) : [];
  const allSelected = pageIds.length > 0 && pageIds.every(rowId => selected.has(rowId));
  function toggleRow(rowId: number) { setSelected(current => { const next = new Set(current); if (next.has(rowId)) next.delete(rowId); else next.add(rowId); return next; }); }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(pageIds.slice(0, MAX_BATCH_UNBIND))); }
  function batchUnbind() {
    const ids = [...selected].slice(0, MAX_BATCH_UNBIND);
    if (ids.length && confirm(`确认批量解除选中的 ${ids.length} 台设备授权？\n解除后这些设备立即失去授权，对应卡密保持已使用、不会恢复为未使用。此操作不可撤销。`)) void mutate({ action: "binding.delete-batch", ids });
  }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">应用与设备授权</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">统一管理原 Mantou Admin 的应用、卡密和设备绑定。旧客户端继续使用原接口，签名安装服务保持运行。</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-500">{error}<button className="ml-3 underline" onClick={() => setRevision(v => v + 1)}>重新加载</button></div>}
    {notice && <div role="status" className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600">{notice}</div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["应用", data?.stats.apps], ["全部授权卡密", data?.stats.cards], ["未使用卡密", data?.stats.available], ["设备绑定", data?.stats.bindings]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"><p className="text-sm text-[var(--text-secondary)]">{label}</p><p className="mt-2 text-2xl font-semibold">{value ?? "—"}</p></div>)}</div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="授权管理">{(Object.keys(labels) as Tab[]).map(item => <button key={item} role="tab" aria-selected={tab === item} disabled={busy} onClick={() => changeTab(item)} className={`${buttonClass} ${tab === item ? "bg-[var(--accent)] text-white" : ""}`}>{labels[item]}</button>)}</div>

    {tab === "apps" && <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={disabled} onClick={() => { setApp({ ...blankApp }); setEditing(false); }}>添加应用</button><button className={buttonClass} disabled={disabled} onClick={() => void mutate({ action: "app.sync" })}><RefreshCw size={14} className="mr-1 inline" />从 IPA 服务同步</button></div>}
    {app && tab === "apps" && <form className="space-y-4 rounded-2xl border border-[var(--border)] p-5" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: "app.save", ...app })) setApp(null); }}>
      <h2 className="font-semibold">{editing ? "编辑应用" : "添加应用"}</h2>
      <div className="grid gap-3 md:grid-cols-2">{([['id','应用 ID'],['name','应用名称'],['version','版本号'],['identifier','Bundle ID'],['plist','Plist 地址'],['pkg','IPA 地址']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><input className={inputClass} type={key === "plist" || key === "pkg" ? "url" : "text"} required={key === "id" || key === "name"} maxLength={255} disabled={busy || (editing && key === "id")} value={app[key]} onChange={e => setApp({ ...app, [key]: e.target.value })} /></label>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={app.requiresKey} disabled={busy} onChange={e => setApp({ ...app, requiresKey: e.target.checked })} />需要卡密解锁</label>
      <div className="flex gap-2"><button className={buttonClass} disabled={busy}>保存应用</button><button type="button" className={buttonClass} disabled={busy} onClick={() => setApp(null)}>取消</button></div>
    </form>}

    {tab === "cards" && <div className="grid gap-4 lg:grid-cols-2"><form className="space-y-3 rounded-2xl border border-[var(--border)] p-5" onSubmit={e => { e.preventDefault(); void mutate({ action: "card.generate", count }); }}><h2 className="font-semibold"><KeyRound size={16} className="mr-2 inline" />生成授权卡密</h2><p className="text-xs text-[var(--text-secondary)]">沿用原系统规则：一张卡绑定一台设备，解锁需要卡密的应用。无到期时间。</p><label className="block text-sm">生成数量（1–500）<input aria-label="生成数量" className={`${inputClass} mt-1`} type="number" min={1} max={500} required value={count} onChange={e => setCount(Number(e.target.value))} disabled={busy} /></label><button className={buttonClass} disabled={disabled}>生成卡密</button></form>
      <form className="space-y-3 rounded-2xl border border-[var(--border)] p-5" onSubmit={e => { e.preventDefault(); void mutate({ action: "card.import", cards: imports.split(/\r?\n/).map(v => v.trim()).filter(Boolean) }).then(ok => { if (ok) setImports(""); }); }}><h2 className="font-semibold">导入现有卡密</h2><textarea aria-label="导入卡密，每行一张" className={inputClass} rows={3} maxLength={32000} placeholder="每行一张，单次最多 500 张；已有卡密自动跳过" required value={imports} disabled={busy} onChange={e => setImports(e.target.value)} /><button className={buttonClass} disabled={disabled}>导入卡密</button></form></div>}
    {tab === "cards" && generated.length > 0 && <div className="space-y-3 rounded-2xl border border-emerald-500/30 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">本次新增 {generated.length} 张卡密</h2><button className={buttonClass} onClick={downloadCards}><Download size={14} className="mr-1 inline" />下载卡密 TXT</button></div><textarea aria-label="本次新增卡密" readOnly value={generated.join("\n")} rows={Math.min(8, generated.length)} className={`${inputClass} font-mono`} /></div>}

    {tab === "bindings" && data && <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
      <h2 className="font-semibold">到期自动解除规则</h2>
      <p className="text-[var(--text-secondary)]">{ttlDays ? `设备绑定（以绑定时间计）满 ${ttlDays} 天后由定时任务自动解除，与手动「解除绑定」相同：只删除设备绑定。到期解除后卡密不会恢复为未使用，原卡密随之作废。` : "已关闭到期自动解除，设备绑定将一直有效，直到手动解除。"}</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const days = Number(ttlInput); if (Number.isInteger(days) && days !== ttlDays && confirm(days ? `将自动解除期限改为 ${days} 天？绑定时间早于 ${days} 天前的设备会在下次定时任务时被解除。` : "关闭到期自动解除？")) void mutate({ action: "binding.ttl", days }); }}><label className="text-sm">自动解除天数（0 表示关闭）<input aria-label="自动解除天数" className={`${inputClass} mt-1 w-40`} type="number" min={0} max={3650} step={1} required value={ttlInput} disabled={busy} onChange={e => setTtlInput(e.target.value)} /></label><button className={buttonClass} disabled={disabled || ttlInput === String(ttlDays)}>保存期限</button></form>
    </div>}
    {tab === "bindings" && <form className="space-y-3 rounded-2xl border border-[var(--border)] p-5" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: "binding.add", udid, cardKey })) { setUdid(""); setCardKey(""); } }}><h2 className="font-semibold"><Smartphone size={16} className="mr-2 inline" />手动授权设备</h2><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">设备 UDID<input className={`${inputClass} mt-1`} required maxLength={255} value={udid} disabled={busy} onChange={e => setUdid(e.target.value)} /></label><label className="text-sm">未使用的卡密<input className={`${inputClass} mt-1`} required maxLength={255} value={cardKey} disabled={busy} onChange={e => setCardKey(e.target.value)} /></label></div><button className={buttonClass} disabled={disabled}>绑定设备并使用卡密</button></form>}

    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <form onSubmit={searchRows} className="flex flex-wrap items-center gap-2"><input className={`${inputClass} min-w-0 flex-1`} aria-label="搜索" maxLength={255} placeholder={tab === "apps" ? "搜索应用名称、ID 或 Bundle ID" : "搜索卡密或设备 UDID"} value={searchInput} onChange={e => setSearchInput(e.target.value)} /><button className={buttonClass} disabled={busy}><Search size={14} className="mr-1 inline" />搜索</button>{tab === "cards" && <select aria-label="卡密状态" className={buttonClass} value={status} disabled={busy} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="all">全部状态</option><option value="unused">未使用</option><option value="used">已使用</option></select>}<button type="button" className={buttonClass} disabled={disabled} onClick={() => setRevision(v => v + 1)}>刷新</button>{tab === "bindings" && <button type="button" className={`${buttonClass} text-red-500`} disabled={disabled || selected.size === 0} onClick={batchUnbind}>批量解除{selected.size ? `（${selected.size}）` : ""}</button>}</form>
      {loading ? <p role="status" className="py-10 text-center text-sm">正在加载授权数据…</p> : data && data.rows.length === 0 ? <p className="py-10 text-center text-sm text-[var(--text-secondary)]">暂无符合条件的记录</p> : data && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-[var(--border)]">{tab === "bindings" && <th className="w-8 px-2 py-3"><input type="checkbox" aria-label="全选当前页" checked={allSelected} disabled={disabled} onChange={toggleAll} /></th>}{(tab === "apps" ? ["应用", "版本", "卡密验证", "操作"] : tab === "cards" ? ["卡密", "状态", "绑定数", "操作"] : ["设备 UDID", "卡密", "绑定时间", "自动解除", "操作"]).map(label => <th className="whitespace-nowrap px-2 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
        {tab === "apps" ? <><td className="px-2 py-4"><p>{row.name}</p><p className="mt-1 max-w-64 truncate text-xs text-[var(--text-secondary)]" title={String(row.id)}>{row.identifier || row.id}</p></td><td className="px-2 py-4">{row.version || "—"}</td><td className="px-2 py-4"><button className={buttonClass} disabled={disabled} onClick={() => { const requiresKey = !row.requires_key; if (requiresKey || confirm(`关闭“${row.name}”的卡密验证后，未授权设备也可下载。是否继续？`)) void mutate({ action: "app.require-key", id: String(row.id), requiresKey }); }}>{row.requires_key ? "已开启" : "已关闭"}</button></td><td className="whitespace-nowrap px-2 py-4"><button className={`${buttonClass} mr-2`} disabled={disabled} onClick={() => { setEditing(true); setApp({ id: String(row.id), name: row.name || "", version: row.version || "", identifier: row.identifier || "", plist: row.plist || "", pkg: row.pkg || "", requiresKey: Boolean(row.requires_key) }); }}>编辑</button><button className={`${buttonClass} text-red-500`} disabled={disabled} onClick={() => { if (confirm(`删除应用“${row.name}”？旧客户端将不再能获取该应用。原卡密和绑定保留。`)) void mutate({ action: "app.delete", id: String(row.id) }); }}>删除</button></td></>
        : tab === "cards" ? <><td className="whitespace-nowrap px-2 py-4 font-mono">{row.card_key}</td><td className="whitespace-nowrap px-2 py-4">{row.used ? "已使用" : "未使用"}</td><td className="px-2 py-4">{row.binding_count}</td><td className="whitespace-nowrap px-2 py-4">{Boolean(row.used) && <button className={`${buttonClass} mr-2`} disabled={disabled || Boolean(row.binding_count)} onClick={() => { if (confirm("将这张卡密恢复为未使用，使其可再次授权设备？")) void mutate({ action: "card.reset", id: Number(row.id) }); }}>重置</button>}<button className={`${buttonClass} text-red-500`} disabled={disabled} onClick={() => { if (confirm(`删除这张卡密及其 ${row.binding_count} 条设备绑定？关联设备将失去授权。`)) void mutate({ action: "card.delete", id: Number(row.id) }); }}>删除</button></td></>
        : <><td className="px-2 py-4"><input type="checkbox" aria-label={`选择设备 ${row.udid}`} checked={selected.has(Number(row.id))} disabled={disabled} onChange={() => toggleRow(Number(row.id))} /></td><td className="max-w-64 break-all px-2 py-4 font-mono text-xs">{row.udid}</td><td className="whitespace-nowrap px-2 py-4 font-mono text-xs">{row.card_key}</td><td className="whitespace-nowrap px-2 py-4">{row.created_at ? new Date(row.created_at).toLocaleDateString("zh-CN") : "—"}</td><td className="whitespace-nowrap px-2 py-4">{(({ date, left }) => <><p>{date}</p>{left && <p className={`mt-1 text-xs ${row.expires_in != null && row.expires_in <= 0 ? "text-red-500" : "text-[var(--text-secondary)]"}`}>{left}</p>}</>)(expiryLabel(row, ttlDays))}</td><td className="px-2 py-4"><button className={`${buttonClass} whitespace-nowrap text-red-500`} disabled={disabled} onClick={() => { if (confirm("解除该设备授权？卡密仍保持已使用状态。")) void mutate({ action: "binding.delete", id: Number(row.id) }); }}>解除绑定</button></td></>}
      </tr>)}</tbody></table></div>}
      {data && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>共 {data.total} 条 · 第 {page} / {totalPages} 页</p><div className="flex gap-2"><button className={buttonClass} disabled={disabled || page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button><button className={buttonClass} disabled={disabled || page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button></div></div>}
    </div>
  </div>;
}
