"use client";

import { useCallback, useEffect, useState } from "react";
import type { RegionStatus } from "@/lib/assistant-services";

type Manifest = { id: string; bundleId: string; title: string; version: string; createdAt: string; expiresAt: string; fetchedAt: string | null; fetchCount: number };
type Snapshot = { id: string; region: string; reachable: boolean; createdAt: string };
type Data = { regions: RegionStatus[]; manifests: Manifest[]; snapshots: Snapshot[] };
const labels: Record<string, string> = { ok: "成功", busy: "排队繁忙", authentication_unavailable: "认证暂不可用", auth_code_required: "需要验证码", invalid_credentials: "登录凭证失效", account_disabled: "账号已停用", authentication_locked: "自动登录已暂停", purchase_unavailable: "领取授权失败", download_unavailable: "下载准备失败", upstream_failure: "上游请求失败" };
function date(value?: string | null) { return value ? new Date(value).toLocaleString("zh-CN") : "暂无"; }
function bytes(value: number) { return `${(value / 1024 / 1024).toFixed(1)} MB`; }

export default function AssistantServicesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/assistant-services", { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "读取失败");
      setData(body.data); setError("");
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "读取失败");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => { if (!document.hidden) void load(controller.signal); }, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);
  const requests = data?.regions.flatMap(region => (region.data?.requests?.recent || []).map(event => ({ ...event, region: region.region }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100) || [];
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">助手服务</h1><p className="mt-2 text-sm text-gray-500">在线安装清单与中美区下载服务。每 30 秒刷新；这里只监控，不会触发登录或下载。</p></div><button className="rounded-lg border px-4 py-2" disabled={loading} onClick={() => void load()}>{loading ? "读取中…" : "刷新"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}。下方已有数据可能已过期。</p>}
    <div className="grid gap-4 md:grid-cols-2">{data?.regions.map(region => {
      const service = region.data; const auth = service?.auth;
      const cooldown = auth?.cooldownUntil && new Date(auth.cooldownUntil).getTime() > Date.now();
      return <section key={region.region} className="rounded-xl border bg-white p-5 text-gray-900">
        <h2 className="text-lg font-semibold">{region.region === "cn" ? "中国区" : "美国区"} · {region.reachable ? "服务可达" : "服务不可达"}</h2>
        <p className="text-sm text-gray-500">采样：{date(region.sampledAt)}</p>
        {!service ? <p className="mt-3 text-red-700">{region.error}</p> : <div className="mt-4 space-y-2 text-sm">
          <p>认证：{auth?.locked ? labels[auth.lockCode || ""] || "需管理员处理" : cooldown ? `冷却至 ${date(auth?.cooldownUntil)}` : auth?.lastError ? `最近失败：${labels[auth.lastError] || auth.lastError}` : "暂无失败记录"}</p>
          <p>最近自动登录成功：{date(auth?.lastSignIn)}</p><p>当前任务：{service.busy || "空闲"}</p>
          <p>缓存：{service.artifacts.count} 个 / {bytes(service.artifacts.bytes)}，上限 {bytes(service.artifacts.maxBytes)}；已淘汰 {service.artifacts.evicted} 个</p>
          <p className="text-gray-500">统计起点：{date(service.requests?.startedAt)}（进程重启后重新计数）</p>
          <div className="flex flex-wrap gap-2">{Object.entries(service.requests?.counts || {}).map(([key, count]) => <span key={key} className="rounded bg-gray-100 px-2 py-1">{key.split(":")[0]} · {labels[key.split(":")[1]] || key.split(":")[1]}：{count}</span>)}</div>
          <p className="text-gray-500">服务可达不代表 Apple 账号当前可用。认证状态来自最近业务请求。</p>
        </div>}
      </section>;
    })}</div>
    <section className="rounded-xl border bg-white p-5 text-gray-900"><h2 className="text-lg font-semibold">最近下载请求</h2><p className="mb-3 text-sm text-gray-500">各进程保留最近 100 条；仅显示脱敏诊断。</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["时间 / 请求 ID", "地区 / 阶段", "App / 版本 ID", "结果", "耗时", "诊断"].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{requests.map(row => <tr className="border-t" key={row.region + row.id}><td className="p-2">{date(row.at)}<br /><code>{row.id}</code></td><td className="p-2">{row.region} / {row.endpoint}</td><td className="p-2">{row.appId}<br />{row.appVerId}</td><td className="p-2">{labels[row.result] || row.result}</td><td className="p-2">{(row.durationMs / 1000).toFixed(2)} 秒</td><td className="p-2">{[row.diagnostic.stage, row.diagnostic.kind, row.diagnostic.upstreamStatus ? `HTTP ${row.diagnostic.upstreamStatus}` : ""].filter(Boolean).join(" / ") || "—"}</td></tr>)}</tbody></table>{!requests.length && <p className="p-4 text-gray-500">尚无请求记录。</p>}</div></section>
    <section className="rounded-xl border bg-white p-5 text-gray-900"><h2 className="text-lg font-semibold">在线安装清单</h2><p className="mb-3 text-sm text-gray-500">IPA 始终由手机本地提供，不上传。清单有效期 24 小时；清单被读取不代表安装完成。</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["应用", "创建时间", "状态", "读取次数"].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data?.manifests.map(row => <tr className="border-t" key={row.id}><td className="p-2">{row.title} · {row.version}<br /><span className="text-gray-500">{row.bundleId}</span></td><td className="p-2">{date(row.createdAt)}</td><td className="p-2">{new Date(row.expiresAt).getTime() <= Date.now() ? "已过期" : row.fetchedAt ? "清单已读取" : "清单已生成"}</td><td className="p-2">{row.fetchCount}</td></tr>)}</tbody></table>{!data?.manifests.length && <p className="p-4 text-gray-500">暂无新清单。</p>}</div></section>
    <section className="rounded-xl border bg-white p-5 text-gray-900"><h2 className="text-lg font-semibold">持续采样记录</h2><p className="text-sm text-gray-500">每分钟采样，保留 7 天；展示最近 120 条。采样中断时不会用旧数据冒充正常状态。</p><p className="my-2 text-sm">最新记录：{date(data?.snapshots[0]?.createdAt)}</p><div className="flex flex-wrap gap-2">{data?.snapshots.slice(0, 30).map(sample => <span title={date(sample.createdAt)} key={sample.id} className={`rounded px-2 py-1 text-xs ${sample.reachable ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{sample.region} {sample.reachable ? "可达" : "不可达"} {new Date(sample.createdAt).toLocaleTimeString("zh-CN")}</span>)}</div></section>
  </div>;
}
