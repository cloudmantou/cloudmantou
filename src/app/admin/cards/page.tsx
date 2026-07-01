"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Plus, Download, Ban, CheckCircle, Copy, ChevronDown } from "lucide-react";

type Card = {
  id: string;
  cardNo: string;
  cardSecret: string;
  type: string;
  value: number;
  status: string;
  batchNo: string | null;
  usedBy: string | null;
  usedAt: string | null;
  expireAt: string | null;
  createdAt: string;
  user?: { username: string; nickname: string | null } | null;
};

const TYPE_LABELS: Record<string, string> = {
  VIP_DAYS: "VIP天数",
  PAID_ARTICLE: "付费文章",
  BALANCE: "余额",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "可用",
  USED: "已使用",
  DISABLED: "已禁用",
  EXPIRED: "已过期",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--teal)",
  USED: "var(--text-muted)",
  DISABLED: "var(--rose)",
  EXPIRED: "var(--orange)",
};

export default function AdminCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Generate form
  const [showGen, setShowGen] = useState(false);
  const [genType, setGenType] = useState("VIP_DAYS");
  const [genValue, setGenValue] = useState("30");
  const [genCount, setGenCount] = useState("10");
  const [genExpireDays, setGenExpireDays] = useState("365");
  const [genBatchNo, setGenBatchNo] = useState("");
  const [genResult, setGenResult] = useState<any>(null);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/cards?${params}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setCards(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e: any) {
      setLoadError(e.message || "加载失败");
    }
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { load(page); }, [page, load]);

  const handleGenerate = () => {
    setGenError("");
    setGenResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: genType,
            value: parseInt(genValue) || 30,
            count: parseInt(genCount) || 10,
            expireDays: parseInt(genExpireDays) || 365,
            batchNo: genBatchNo.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setGenResult(data.data);
        load(1);
      } catch (e: any) {
        setGenError(e.message);
      }
    });
  };

  const handleToggle = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    startTransition(async () => {
      const res = await fetch(`/api/admin/cards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) load(page);
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    window.open(`/api/admin/cards/export?${params}`, "_blank");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}>
            卡密管理
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
            共 {total} 张卡密
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", fontFamily: '"DM Mono", monospace' }}
          >
            <Download size={13} aria-hidden="true" />
            导出 CSV
          </button>
          <button
            type="button"
            onClick={() => { setShowGen(!showGen); setGenResult(null); setGenError(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"DM Mono", monospace' }}
          >
            <Plus size={14} aria-hidden="true" />
            批量生成
          </button>
        </div>
      </div>

      {/* Generate form */}
      {showGen && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>批量生成卡密</h3>
          {genError && (
            <div className="mb-3 p-2 rounded text-xs" style={{ background: "rgba(232,99,122,0.1)", color: "var(--rose)" }}>{genError}</div>
          )}
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>类型</label>
              <select value={genType} onChange={(e) => setGenType(e.target.value)} className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="VIP_DAYS">VIP天数</option>
                <option value="PAID_ARTICLE">付费文章</option>
                <option value="BALANCE">余额</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>数值</label>
              <input type="number" value={genValue} onChange={(e) => setGenValue(e.target.value)} min="1" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>数量</label>
              <input type="number" value={genCount} onChange={(e) => setGenCount(e.target.value)} min="1" max="500" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>有效天数</label>
              <input type="number" value={genExpireDays} onChange={(e) => setGenExpireDays(e.target.value)} min="1" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>批次号(可选)</label>
              <input type="text" value={genBatchNo} onChange={(e) => setGenBatchNo(e.target.value)} placeholder="自动生成" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }} />
            </div>
          </div>
          <button type="button" onClick={handleGenerate} disabled={isPending} className="px-4 py-1.5 text-xs rounded-md" style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"DM Mono", monospace', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "生成中..." : "生成"}
          </button>

          {genResult && (
            <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--teal-dim)", border: "1px solid var(--teal)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ color: "var(--teal)" }}>
                  生成成功: {genResult.count} 张 · 批次: {genResult.batchNo}
                </span>
                <button type="button" onClick={() => copyToClipboard(genResult.cards.map((c: any) => `${c.cardNo},${c.cardSecret}`).join("\n"))} className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--teal)", fontFamily: '"DM Mono", monospace' }}>
                  <Copy size={11} aria-hidden="true" />
                  {copied ? "已复制" : "复制全部"}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto text-[10px]" style={{ fontFamily: '"DM Mono", monospace', color: "var(--text-secondary)" }}>
                {genResult.cards.map((c: any) => (
                  <div key={c.cardNo} className="flex gap-4 py-0.5">
                    <span>{c.cardNo}</span>
                    <span>{c.cardSecret}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex gap-1">
          {[{ id: "", label: "全部类型" }, { id: "VIP_DAYS", label: "VIP" }, { id: "PAID_ARTICLE", label: "付费文章" }, { id: "BALANCE", label: "余额" }].map((f) => (
            <button key={f.id} type="button" onClick={() => { setTypeFilter(f.id); setPage(1); }} className="px-2 py-1 rounded-md text-[10px] border transition-colors" style={{ borderColor: typeFilter === f.id ? "var(--accent)" : "var(--border)", background: typeFilter === f.id ? "var(--accent-dim)" : "transparent", color: typeFilter === f.id ? "var(--accent)" : "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[{ id: "", label: "全部状态" }, { id: "ACTIVE", label: "可用" }, { id: "USED", label: "已使用" }, { id: "DISABLED", label: "已禁用" }].map((f) => (
            <button key={f.id} type="button" onClick={() => { setStatusFilter(f.id); setPage(1); }} className="px-2 py-1 rounded-md text-[10px] border transition-colors" style={{ borderColor: statusFilter === f.id ? "var(--accent)" : "var(--border)", background: statusFilter === f.id ? "var(--accent-dim)" : "transparent", color: statusFilter === f.id ? "var(--accent)" : "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)" }}>
              {["卡号", "卡密", "类型", "数值", "状态", "批次", "使用者", "操作"].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: "var(--rose)" }}>{loadError}</td></tr>
            ) : cards.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>暂无卡密</td></tr>
            ) : cards.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-3 py-2 text-xs" style={{ fontFamily: '"DM Mono", monospace', color: "var(--text)" }}>{c.cardNo}</td>
                <td className="px-3 py-2 text-xs" style={{ fontFamily: '"DM Mono", monospace', color: "var(--text-muted)" }}>{c.cardSecret}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{TYPE_LABELS[c.type]}</td>
                <td className="px-3 py-2 text-xs" style={{ fontFamily: '"DM Mono", monospace', color: "var(--accent)" }}>{c.value}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[c.status]}15`, color: STATUS_COLORS[c.status], fontFamily: '"DM Mono", monospace' }}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>{c.batchNo || "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{c.user?.nickname || c.user?.username || "—"}</td>
                <td className="px-3 py-2">
                  {(c.status === "ACTIVE" || c.status === "DISABLED") && (
                    <button type="button" onClick={() => handleToggle(c.id, c.status)} disabled={isPending} className="p-1 rounded-md transition-colors" style={{ color: c.status === "ACTIVE" ? "var(--rose)" : "var(--teal)" }} title={c.status === "ACTIVE" ? "禁用" : "启用"}>
                      {c.status === "ACTIVE" ? <Ban size={13} aria-hidden="true" /> : <CheckCircle size={13} aria-hidden="true" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs transition-colors" style={{ background: p === page ? "var(--accent)" : "transparent", color: p === page ? "var(--bg)" : "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
