"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Copy, Download, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type Card = {
  id: string;
  cardNo: string;
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

type CardStats = {
  total: number;
  used: number;
  active: number;
  disabled: number;
  expired: number;
  weekNew: number;
  revenue: number;
  sellRate: number;
  products: Array<{ type: string; value: number; total: number; active: number; used: number }>;
  batches: Array<{ batchNo: string | null; count: number; createdAt: string | null }>;
};

const TYPE_LABELS: Record<string, string> = {
  VIP_DAYS: "VIP天数",
  PAID_ARTICLE: "付费文章",
  BALANCE: "余额",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "未售出",
  USED: "已售出",
  DISABLED: "已冻结",
  EXPIRED: "已过期",
};

const PRODUCT_PRESETS = [
  { id: "vip30", type: "VIP_DAYS", value: 30, name: "VIP 月卡", price: 29.9 },
  { id: "vip90", type: "VIP_DAYS", value: 90, name: "VIP 季卡", price: 79.9 },
  { id: "vip365", type: "VIP_DAYS", value: 365, name: "VIP 年卡", price: 268 },
  { id: "article1", type: "PAID_ARTICLE", value: 1, name: "付费文章券", price: 9.9 },
  { id: "balance100", type: "BALANCE", value: 100, name: "余额卡", price: 100 },
];

type TabId = "generate" | "inventory" | "products" | "logs";

export default function AdminCardsPage() {
  const [tab, setTab] = useState<TabId>("generate");
  const [stats, setStats] = useState<CardStats | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [genType, setGenType] = useState("VIP_DAYS");
  const [genValue, setGenValue] = useState("30");
  const [genCount, setGenCount] = useState("50");
  const [genExpireDays, setGenExpireDays] = useState("365");
  const [genBatchNo, setGenBatchNo] = useState("");
  const [genPrefix, setGenPrefix] = useState("CM");
  const [genFormat, setGenFormat] = useState("standard");
  const [genRemark, setGenRemark] = useState("");
  const [genImport, setGenImport] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(PRODUCT_PRESETS[0].id);
  const [genResult, setGenResult] = useState<{ batchNo: string; count: number; cards: Array<{ cardNo: string; cardSecret: string }> } | null>(null);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cards/stats");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.data);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (statusFilter) params.set("status", statusFilter);
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/cards?${params}`);
        if (!res.ok) throw new Error(`请求失败 (${res.status})`);
        const data = await res.json();
        setCards(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "加载失败");
      }
      setLoading(false);
    },
    [statusFilter, search]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "inventory" || tab === "logs") load(page);
  }, [page, load, tab]);

  const applyPreset = (presetId: string) => {
    const preset = PRODUCT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setGenType(preset.type);
    setGenValue(String(preset.value));
  };

  const handleGenerate = () => {
    setGenError("");
    setGenResult(null);
    const importLines = genImport
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: genType,
            value: parseInt(genValue) || 30,
            count: importLines.length > 0 ? undefined : parseInt(genCount) || 10,
            expireDays: parseInt(genExpireDays) || 365,
            batchNo: genBatchNo.trim() || genRemark.trim() || undefined,
            prefix: genPrefix.trim() || undefined,
            format: genFormat,
            importLines: importLines.length > 0 ? importLines : undefined,
            autoActivate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setGenResult(data.data);
        loadStats();
        if (tab !== "inventory") setTab("inventory");
        load(1);
      } catch (e: unknown) {
        setGenError(e instanceof Error ? e.message : "生成失败");
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
      if (res.ok) {
        load(page);
        loadStats();
      }
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    window.open(`/api/admin/cards/export?${params}`, "_blank");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const previewKeys = () => {
    const count = Math.min(5, parseInt(genCount) || 5);
    const lines = Array.from({ length: count }, (_, i) => {
      const seg = () =>
        Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 30)]).join("");
      return `${genPrefix || "CM"}-${seg()}-${seg()}-${seg()}`;
    });
    alert(`预览前 ${count} 张卡号:\n\n${lines.join("\n")}`);
  };

  const formatPrice = (type: string, value: number) => {
    if (type === "BALANCE") return `¥${value}`;
    if (type === "VIP_DAYS") return value >= 365 ? `¥268` : value >= 90 ? `¥79.9` : `¥29.9`;
    return `¥${value}`;
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2>卡密管理</h2>
          <p>生成、分发和管理兑换卡密</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleExport}>
            <Download size={13} />
            导出全部
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-accent admin-btn-sm"
            onClick={() => {
              setTab("generate");
              document.getElementById("createSection")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            + 生成卡密
          </button>
        </div>
      </div>

      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">📦 卡密总量</div>
            <div className="admin-stat-value">{stats.total.toLocaleString()}</div>
            <div className="admin-stat-sub">
              <span className="admin-stat-up">↑ {stats.weekNew}</span> 本周新增
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">✅ 已售出</div>
            <div className="admin-stat-value">{stats.used.toLocaleString()}</div>
            <div className="admin-stat-sub">
              售出率 <span className="admin-stat-up">{stats.sellRate}%</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">⏳ 库存剩余</div>
            <div className="admin-stat-value">{stats.active.toLocaleString()}</div>
            <div className="admin-stat-sub">{stats.active < 50 ? "需及时补充" : "库存充足"}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">💰 累计收入</div>
            <div className="admin-stat-value">
              {stats.revenue >= 1000 ? `¥${(stats.revenue / 1000).toFixed(1)}k` : `¥${stats.revenue}`}
            </div>
            <div className="admin-stat-sub">来自已付订单</div>
          </div>
        </div>
      )}

      <div className="admin-tabs">
        {(
          [
            ["generate", "生成卡密"],
            ["inventory", "卡密库存"],
            ["products", "商品管理"],
            ["logs", "操作日志"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "generate" && (
        <div className="admin-panel" id="createSection">
          <div className="admin-panel-header">
            <div className="admin-panel-title">⚡ 快速生成卡密</div>
          </div>
          <div className="admin-panel-body">
            {genError && (
              <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: "var(--rose-dim)", color: "var(--rose)", fontSize: 12 }}>
                {genError}
              </div>
            )}
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">关联商品</label>
                <select
                  className="admin-form-select"
                  value={selectedPreset}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  {PRODUCT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (¥{p.price})
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">生成数量</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="admin-form-input"
                    type="number"
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    min={1}
                    max={500}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>张 (上限 500)</span>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">卡密格式</label>
                <select className="admin-form-select" value={genFormat} onChange={(e) => setGenFormat(e.target.value)}>
                  <option value="standard">标准格式 (XXXX-XXXX-XXXX)</option>
                  <option value="uuid">UUID 格式</option>
                  <option value="numeric">纯数字 (16位)</option>
                  <option value="custom">自定义前缀 + 随机</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">自定义前缀 (可选)</label>
                <input
                  className="admin-form-input"
                  value={genPrefix}
                  onChange={(e) => setGenPrefix(e.target.value.slice(0, 10))}
                  placeholder="如: CM-PRO-"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">有效期</label>
                <select
                  className="admin-form-select"
                  value={genExpireDays}
                  onChange={(e) => setGenExpireDays(e.target.value)}
                >
                  <option value="0">永不过期</option>
                  <option value="30">激活后 30 天</option>
                  <option value="90">激活后 90 天</option>
                  <option value="365">激活后 365 天</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">卡密类型 / 数值</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="admin-form-select" value={genType} onChange={(e) => setGenType(e.target.value)} style={{ flex: 1 }}>
                    <option value="VIP_DAYS">VIP天数</option>
                    <option value="PAID_ARTICLE">付费文章</option>
                    <option value="BALANCE">余额</option>
                  </select>
                  <input
                    className="admin-form-input"
                    type="number"
                    value={genValue}
                    onChange={(e) => setGenValue(e.target.value)}
                    min={1}
                    style={{ width: 80 }}
                  />
                </div>
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">备注标签 (批次号)</label>
                <input
                  className="admin-form-input"
                  value={genRemark}
                  onChange={(e) => setGenRemark(e.target.value)}
                  placeholder="如: 2026年7月促销活动"
                />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">批量导入 (每行一个，覆盖上方生成设置)</label>
                <textarea
                  className="admin-form-textarea"
                  value={genImport}
                  onChange={(e) => setGenImport(e.target.value)}
                  placeholder={"粘贴自定义卡密，每行一个...\n例如:\nCM-XXXX-XXXX-XXXX\nCM-YYYY-YYYY-YYYY,SECRET123"}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "16px 22px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className={`admin-toggle${autoActivate ? " on" : ""}`}
                onClick={() => setAutoActivate((v) => !v)}
                aria-label="生成后自动激活"
              />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>生成后自动激活</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={previewKeys}>
                预览卡密
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-accent admin-btn-sm"
                onClick={handleGenerate}
                disabled={isPending}
              >
                {isPending ? "生成中..." : "生成卡密"}
              </button>
            </div>
          </div>

          {genResult && (
            <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", background: "var(--teal-dim)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal)" }}>
                  生成成功: {genResult.count} 张 · 批次: {genResult.batchNo}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() =>
                    copyToClipboard(genResult.cards.map((c) => `${c.cardNo},${c.cardSecret}`).join("\n"))
                  }
                >
                  <Copy size={11} />
                  {copied ? "已复制" : "复制全部"}
                </button>
              </div>
              <div style={{ maxHeight: 120, overflowY: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                {genResult.cards.map((c) => (
                  <div key={c.cardNo} style={{ display: "flex", gap: 16, padding: "2px 0" }}>
                    <span>{c.cardNo}</span>
                    <span>{c.cardSecret}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <>
          <div className="admin-table-toolbar">
            <div className="admin-search-box">
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                placeholder="搜索卡密、批次..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput);
                    setPage(1);
                  }
                }}
              />
            </div>
            <div className="admin-filter-chips">
              {[
                { id: "", label: "全部" },
                { id: "ACTIVE", label: "未售" },
                { id: "USED", label: "已售" },
                { id: "EXPIRED", label: "已过期" },
                { id: "DISABLED", label: "已冻结" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`admin-chip${statusFilter === f.id ? " active" : ""}`}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setPage(1);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-key-table">
              <thead>
                <tr>
                  <th>卡号</th>
                  <th>类型</th>
                  <th>面值</th>
                  <th>状态</th>
                  <th>批次</th>
                  <th>使用者</th>
                  <th>使用时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      加载中...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--rose)" }}>
                      {loadError}
                    </td>
                  </tr>
                ) : cards.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div style={{ padding: 32 }}>
                        <EmptyState title="暂无卡密" description="还没有任何卡密记录。" />
                      </div>
                    </td>
                  </tr>
                ) : (
                  cards.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.cardNo}</td>
                      <td>
                        <span className="admin-badge purple">{TYPE_LABELS[c.type] || c.type}</span>
                      </td>
                      <td className="mono">{formatPrice(c.type, c.value)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            c.status === "USED"
                              ? "success"
                              : c.status === "ACTIVE"
                                ? "warning"
                                : c.status === "DISABLED"
                                  ? "muted"
                                  : "danger"
                          }`}
                        >
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>{c.batchNo || "—"}</td>
                      <td>{c.user?.nickname || c.user?.username || "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {c.usedAt ? new Date(c.usedAt).toLocaleString("zh-CN") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => copyToClipboard(c.cardNo)}
                          >
                            复制
                          </button>
                          {(c.status === "ACTIVE" || c.status === "DISABLED") && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => handleToggle(c.id, c.status)}
                              disabled={isPending}
                            >
                              {c.status === "ACTIVE" ? "冻结" : "解冻"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <span>共 {total} 条记录</span>
            {totalPages > 1 && (
              <div className="admin-page-btns">
                <button
                  type="button"
                  className="admin-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`admin-page-btn${p === page ? " active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="admin-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "products" && stats && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>管理您的卡密商品和定价方案</div>
          </div>
          <div className="admin-product-grid">
            {stats.products.map((p) => {
              const preset = PRODUCT_PRESETS.find((x) => x.type === p.type && x.value === p.value);
              return (
                <div
                  key={`${p.type}-${p.value}`}
                  className={`admin-product-card${selectedPreset === preset?.id ? " selected" : ""}`}
                  onClick={() => {
                    if (preset) {
                      applyPreset(preset.id);
                      setTab("generate");
                    }
                  }}
                >
                  <div className="admin-product-name">
                    {preset?.name || `${TYPE_LABELS[p.type]} · ${p.value}`}
                  </div>
                  <div className="admin-product-price">
                    {formatPrice(p.type, p.value)}
                  </div>
                  <div className="admin-product-meta">
                    <span>📦 库存 {p.active}</span>
                    <span>✅ 已售 {p.used}</span>
                  </div>
                </div>
              );
            })}
            {stats.products.length === 0 &&
              PRODUCT_PRESETS.map((p) => (
                <div
                  key={p.id}
                  className="admin-product-card"
                  onClick={() => {
                    applyPreset(p.id);
                    setTab("generate");
                  }}
                >
                  <div className="admin-product-name">{p.name}</div>
                  <div className="admin-product-price">¥{p.price}</div>
                  <div className="admin-product-meta">
                    <span>📦 库存 0</span>
                    <span>点击生成</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === "logs" && stats && (
        <div className="admin-table-wrap">
          <table className="admin-key-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>批次</th>
                <th>数量</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {stats.batches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    暂无操作日志
                  </td>
                </tr>
              ) : (
                stats.batches.map((b) => (
                  <tr key={b.batchNo || "unknown"}>
                    <td>
                      {b.createdAt ? new Date(b.createdAt).toLocaleString("zh-CN") : "—"}
                    </td>
                    <td>
                      <span className="admin-badge success">生成</span>
                    </td>
                    <td className="mono">{b.batchNo || "—"}</td>
                    <td>{b.count}</td>
                    <td style={{ color: "var(--text-muted)" }}>批量生成</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}