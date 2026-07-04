"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Copy, Download, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CardPackageEditor,
  type CardPackageRecord,
  type CardPackageSavePayload,
} from "@/components/admin/CardPackageEditor";

type Card = {
  id: string;
  cardNo: string;
  type: string;
  value: number;
  status: string;
  batchNo: string | null;
  packageId: string | null;
  packageName: string | null;
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
  products: Array<{ packageId: string; total: number; active: number; used: number }>;
  batches: Array<{ batchNo: string | null; count: number; createdAt: string | null }>;
};

const TYPE_LABELS: Record<string, string> = {
  VIP_DAYS: "VIP天数",
  PAID_ARTICLE: "付费文章",
  BALANCE: "余额",
  GENERIC: "外部/通用",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "未售出",
  SOLD: "已售出",
  USED: "已兑换",
  DISABLED: "已冻结",
  EXPIRED: "已过期",
};

function formatCardValue(type: string, value: number) {
  switch (type) {
    case "VIP_DAYS":
      return `${value} 天`;
    case "PAID_ARTICLE":
      return `${value} 篇`;
    case "BALANCE":
      return `¥${value}`;
    case "GENERIC":
      return "通用";
    default:
      return String(value);
  }
}

type MembershipProduct = {
  productType: string;
  id: string;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  published: boolean;
  enabled: boolean;
};

type TabId = "generate" | "inventory" | "products" | "logs";

export default function AdminCardsPage() {
  const [tab, setTab] = useState<TabId>("generate");
  const [stats, setStats] = useState<CardStats | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [hideVipCards, setHideVipCards] = useState(true);
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
  const [genMode, setGenMode] = useState<"import" | "random">("import");
  const [importMode, setImportMode] = useState<"secrets" | "pairs">("secrets");
  const [autoActivate, setAutoActivate] = useState(true);
  const [cardPackages, setCardPackages] = useState<CardPackageRecord[]>([]);
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [editingPackage, setEditingPackage] = useState<CardPackageRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("edit");
  const [genResult, setGenResult] = useState<{ batchNo: string; count: number; cards: Array<{ cardNo: string; cardSecret: string }> } | null>(null);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadMembershipProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/membership-products");
      if (!res.ok) return;
      const data = await res.json();
      setMembershipProducts((data.data || []) as MembershipProduct[]);
    } catch {
      /* ignore */
    }
  }, []);

  const loadCardPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/card-packages");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.data || []) as CardPackageRecord[];
      setCardPackages(list);
      setSelectedPackageId((prev) => {
        if (prev && list.some((item) => item.id === prev)) return prev;
        const first = list[0];
        if (first) {
          setGenType(first.cardType);
          setGenValue(String(first.cardValue));
          return first.id;
        }
        return prev;
      });
    } catch {
      /* ignore */
    }
  }, []);

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
        if (packageFilter) params.set("packageId", packageFilter);
        if (hideVipCards) params.set("excludeType", "VIP_DAYS");
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
    [statusFilter, packageFilter, hideVipCards, search]
  );

  useEffect(() => {
    loadStats();
    loadCardPackages();
    loadMembershipProducts();
  }, [loadStats, loadCardPackages, loadMembershipProducts]);

  useEffect(() => {
    if (tab === "inventory" || tab === "logs") load(page);
  }, [page, load, tab]);

  const applyPackage = (pkg: CardPackageRecord) => {
    setSelectedPackageId(pkg.id);
    setGenType(pkg.cardType);
    setGenValue(String(pkg.cardValue));
    if (pkg.cardType === "GENERIC") {
      setGenMode("import");
      setImportMode("secrets");
    }
  };

  const selectedPackage = cardPackages.find((p) => p.id === selectedPackageId);
  const importLineCount = genImport.split("\n").map((l) => l.trim()).filter(Boolean).length;

  const savePackage = (payload: CardPackageSavePayload) => {
    startTransition(async () => {
      const isCreate = editorMode === "create";
      const res = await fetch(
        isCreate ? "/api/admin/card-packages" : `/api/admin/card-packages/${editingPackage!.id}`,
        {
          method: isCreate ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || (isCreate ? "创建失败" : "保存失败"));
        return;
      }
      const saved = data.data as CardPackageRecord;
      setEditorOpen(false);
      setEditingPackage(null);
      setEditorMode("edit");
      await loadCardPackages();
      if (saved?.id) {
        setSelectedPackageId(saved.id);
        applyPackage(saved);
      }
    });
  };

  const openCreatePackage = () => {
    setEditorMode("create");
    setEditingPackage(null);
    setEditorOpen(true);
  };

  const openEditPackage = (pkg: CardPackageRecord) => {
    setEditorMode("edit");
    setEditingPackage(pkg);
    setEditorOpen(true);
  };

  const patchPackage = (id: string, payload: { published?: boolean; enabled?: boolean }) => {
    startTransition(async () => {
      const res = await fetch(`/api/admin/card-packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "操作失败");
        return;
      }
      await loadCardPackages();
    });
  };

  const togglePackagePublish = (pkg: CardPackageRecord) => {
    const nextPublished = !pkg.published;
    patchPackage(pkg.id, {
      published: nextPublished,
      enabled: nextPublished,
    });
  };

  const toggleMembershipPublish = (item: MembershipProduct) => {
    const nextPublished = !item.published;
    startTransition(async () => {
      const res = await fetch("/api/admin/membership-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: item.productType,
          published: nextPublished,
          enabled: nextPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "操作失败");
        return;
      }
      await loadMembershipProducts();
    });
  };

  const deletePackage = (pkg: CardPackageRecord) => {
    const stock = pkg.stock ?? 0;
    const hint =
      stock > 0
        ? `「${pkg.name}」还有 ${stock} 张可售库存，需先清空或售出后才能删除。`
        : `确定删除商品「${pkg.name}」？此操作不可恢复。`;
    if (!window.confirm(hint)) return;
    if (stock > 0) return;

    startTransition(async () => {
      const res = await fetch(`/api/admin/card-packages/${pkg.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "删除失败");
        return;
      }
      if (selectedPackageId === pkg.id) {
        setSelectedPackageId("");
      }
      await loadCardPackages();
    });
  };

  const handleGenerate = () => {
    setGenError("");
    setGenResult(null);
    if (!selectedPackageId) {
      setGenError("请先选择关联商品");
      return;
    }
    const importLines = genImport
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const useImport = genMode === "import" || importLines.length > 0;

    if (useImport && importLines.length === 0) {
      setGenError("请粘贴至少一行卡密");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: selectedPackageId,
            count: useImport ? undefined : parseInt(genCount) || 10,
            expireDays: parseInt(genExpireDays) || 365,
            batchNo: genBatchNo.trim() || genRemark.trim() || undefined,
            prefix: genPrefix.trim() || undefined,
            format: genFormat,
            importLines: useImport ? importLines : undefined,
            importMode: useImport ? importMode : undefined,
            autoActivate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setGenResult(data.data);
        loadStats();
        loadCardPackages();
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
            <div className="admin-panel-title">📥 导入 / 生成卡密</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`admin-chip${genMode === "import" ? " active" : ""}`}
                onClick={() => setGenMode("import")}
              >
                导入卡密
              </button>
              <button
                type="button"
                className={`admin-chip${genMode === "random" ? " active" : ""}`}
                onClick={() => setGenMode("random")}
              >
                随机生成
              </button>
            </div>
          </div>
          <div className="admin-panel-body">
            {genError && (
              <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: "var(--rose-dim)", color: "var(--rose)", fontSize: 12 }}>
                {genError}
              </div>
            )}
            <div className="admin-form-grid">
              <div className="admin-form-group full">
                <label className="admin-form-label">关联商品</label>
                <select
                  className="admin-form-select"
                  value={selectedPackageId}
                  onChange={(e) => {
                    const pkg = cardPackages.find((p) => p.id === e.target.value);
                    if (pkg) applyPackage(pkg);
                  }}
                >
                  {cardPackages.length === 0 ? (
                    <option value="">暂无商品，请先在「商品管理」创建</option>
                  ) : (
                    cardPackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (¥{p.price}) · 库存 {p.stock ?? 0}
                        {p.published ? " · 已发布" : ""}
                      </option>
                    ))
                  )}
                </select>
                {selectedPackage?.description ? (
                  <div className="admin-form-hint" style={{ marginTop: 6 }}>
                    {selectedPackage.description}
                    {selectedPackage.cardType ? (
                      <span>
                        {" "}
                        · 权益 {formatCardValue(selectedPackage.cardType, selectedPackage.cardValue)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {genMode === "import" ? (
                <>
                  <div className="admin-form-group">
                    <label className="admin-form-label">导入格式</label>
                    <select
                      className="admin-form-select"
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as "secrets" | "pairs")}
                    >
                      <option value="secrets">仅卡密（卡号自动生成，推荐）</option>
                      <option value="pairs">卡号 + 卡密（逗号分隔）</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">自动卡号前缀</label>
                    <input
                      className="admin-form-input"
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value.slice(0, 10))}
                      placeholder="CM"
                      disabled={importMode === "pairs"}
                    />
                  </div>
                  <div className="admin-form-group full">
                    <label className="admin-form-label">
                      粘贴卡密 {importLineCount > 0 ? `（已识别 ${importLineCount} 条）` : ""}
                    </label>
                    <textarea
                      className="admin-form-textarea"
                      rows={10}
                      value={genImport}
                      onChange={(e) => setGenImport(e.target.value)}
                      placeholder={
                        importMode === "secrets"
                          ? "每行一个卡密，卡号由系统自动生成\n例如:\nABCD-1234-EFGH-5678\nXK9mP2nQ8rT5vW1y\n第三方平台发来的兑换码..."
                          : "每行一组：卡号,卡密\n例如:\nCM-AAAA-BBBB-CCCC,SECRET123"
                      }
                    />
                  </div>
                </>
              ) : (
                <>
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
                    <label className="admin-form-label">卡号格式</label>
                    <select className="admin-form-select" value={genFormat} onChange={(e) => setGenFormat(e.target.value)}>
                      <option value="standard">标准格式 (XXXX-XXXX-XXXX)</option>
                      <option value="uuid">UUID 格式</option>
                      <option value="numeric">纯数字 (16位)</option>
                      <option value="custom">自定义前缀 + 随机</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">卡号前缀</label>
                    <input
                      className="admin-form-input"
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value.slice(0, 10))}
                      placeholder="CM"
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
                </>
              )}

              <div className="admin-form-group full">
                <label className="admin-form-label">备注标签 (批次号)</label>
                <input
                  className="admin-form-input"
                  value={genRemark}
                  onChange={(e) => setGenRemark(e.target.value)}
                  placeholder="如: 2026年7月促销活动"
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
                aria-label="导入后自动上架"
              />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {genMode === "import" ? "导入后自动上架" : "生成后自动激活"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {genMode === "random" && (
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={previewKeys}>
                  预览卡号
                </button>
              )}
              <button
                type="button"
                className="admin-btn admin-btn-accent admin-btn-sm"
                onClick={handleGenerate}
                disabled={isPending || !selectedPackageId}
              >
                {isPending
                  ? genMode === "import"
                    ? "导入中..."
                    : "生成中..."
                  : genMode === "import"
                    ? `导入${importLineCount > 0 ? ` ${importLineCount} 条` : ""}`
                    : "生成卡密"}
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
            <select
              className="admin-form-select"
              value={packageFilter}
              onChange={(e) => {
                setPackageFilter(e.target.value);
                setPage(1);
              }}
              style={{ minWidth: 160, fontSize: 12 }}
            >
              <option value="">全部商品</option>
              {cardPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`admin-chip${hideVipCards ? " active" : ""}`}
              onClick={() => {
                setHideVipCards((v) => !v);
                setPage(1);
              }}
            >
              隐藏会员类
            </button>
            <div className="admin-filter-chips">
              {[
                { id: "", label: "全部" },
                { id: "ACTIVE", label: "未售" },
                { id: "USED", label: "已售/已兑" },
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
                  <th>所属商品</th>
                  <th>类型</th>
                  <th>权益</th>
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
                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      加载中...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--rose)" }}>
                      {loadError}
                    </td>
                  </tr>
                ) : cards.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div style={{ padding: 32 }}>
                        <EmptyState title="暂无卡密" description="还没有任何卡密记录。" />
                      </div>
                    </td>
                  </tr>
                ) : (
                  cards.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.cardNo}</td>
                      <td style={{ fontSize: 11, maxWidth: 120 }}>{c.packageName || "—"}</td>
                      <td>
                        <span className="admin-badge purple">{TYPE_LABELS[c.type] || c.type}</span>
                      </td>
                      <td className="mono">{formatCardValue(c.type, c.value)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            c.status === "USED" || c.status === "SOLD"
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

      {tab === "products" && (
        <>
          <div className="admin-section-title" style={{ marginBottom: 8 }}>
            会员套餐
          </div>
          <div className="admin-section-desc" style={{ marginBottom: 14 }}>
            月度/年度会员的上下架会同步影响前台商店展示与下单。
          </div>
          <div className="admin-product-grid" style={{ marginBottom: 28 }}>
            {membershipProducts.map((item) => (
              <div key={item.productType} className="admin-product-card">
                <div className="admin-product-name">{item.name}</div>
                <div className="admin-product-price">{item.priceLabel}</div>
                <p className="admin-product-desc">{item.description}</p>
                <div className="admin-product-meta">
                  <span>👑 会员套餐</span>
                  <span className={item.published ? "admin-stat-up" : ""}>
                    {item.published ? "✅ 已上架" : "📝 已下架"}
                  </span>
                </div>
                <div className="admin-product-card-actions">
                  <button
                    type="button"
                    className={`admin-btn admin-btn-sm ${item.published ? "admin-btn-ghost" : "admin-btn-accent"}`}
                    onClick={() => toggleMembershipPublish(item)}
                    disabled={isPending}
                  >
                    {item.published ? "下架" : "上架"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div className="admin-section-title" style={{ marginBottom: 4 }}>
                卡密商品
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                新建商品后，到「生成卡密」导入库存
              </div>
            </div>
            <button type="button" className="admin-btn admin-btn-accent admin-btn-sm" onClick={openCreatePackage}>
              + 新建商品
            </button>
          </div>
          <div className="admin-product-grid">
            {cardPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`admin-product-card${selectedPackageId === pkg.id ? " selected" : ""}`}
              >
                <div className="admin-product-name">{pkg.name}</div>
                <div className="admin-product-price">¥{pkg.price}</div>
                <p className="admin-product-desc">{pkg.description}</p>
                <div className="admin-product-meta">
                  <span>📦 库存 {pkg.stock ?? 0}</span>
                  <span className={pkg.published ? "admin-stat-up" : ""}>
                    {pkg.published ? "✅ 已发布" : "📝 草稿"}
                  </span>
                </div>
                <div className="admin-product-card-actions" style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => openEditPackage(pkg)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={`admin-btn admin-btn-sm ${pkg.published ? "admin-btn-ghost" : "admin-btn-accent"}`}
                    onClick={() => togglePackagePublish(pkg)}
                    disabled={isPending}
                  >
                    {pkg.published ? "下架" : "上架"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-accent admin-btn-sm"
                    onClick={() => {
                      applyPackage(pkg);
                      setTab("generate");
                    }}
                  >
                    导入卡密
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => deletePackage(pkg)}
                    disabled={isPending}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {cardPackages.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: 24 }}>
                <EmptyState title="暂无卡密商品" description="正在初始化默认商品模板，请刷新页面。" />
              </div>
            )}
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
      <CardPackageEditor
        pkg={editingPackage}
        open={editorOpen}
        mode={editorMode}
        saving={isPending}
        onClose={() => {
          setEditorOpen(false);
          setEditingPackage(null);
          setEditorMode("edit");
        }}
        onSave={savePackage}
      />
    </div>
  );
}