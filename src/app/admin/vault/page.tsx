"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
type VaultEntryType = "ACCOUNT" | "SECRET" | "NOTE";

type VaultListItem = {
  id: string;
  title: string;
  type: VaultEntryType;
  account: string | null;
  url: string | null;
  remark: string | null;
  pinned: boolean;
  hasSecret: boolean;
  hasContent: boolean;
  createdAt: string;
  updatedAt: string;
};

type VaultDetail = VaultListItem & {
  secret: string;
  content: string;
};

const VAULT_TYPE_LABELS: Record<VaultEntryType, string> = {
  ACCOUNT: "账号密码",
  SECRET: "密钥令牌",
  NOTE: "保密笔记",
};

type FormState = {
  title: string;
  type: VaultEntryType;
  account: string;
  secret: string;
  url: string;
  content: string;
  remark: string;
  pinned: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  type: "ACCOUNT",
  account: "",
  secret: "",
  url: "",
  content: "",
  remark: "",
  pinned: false,
};

const TYPE_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "全部" },
  { id: "ACCOUNT", label: "账号密码" },
  { id: "SECRET", label: "密钥令牌" },
  { id: "NOTE", label: "保密笔记" },
];

function copyText(text: string) {
  if (!text) return;
  void navigator.clipboard.writeText(text);
}

export default function AdminVaultPage() {
  const [items, setItems] = useState<VaultListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [totpConfigured, setTotpConfigured] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const loadItems = useCallback(async (type: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/vault?${params}`);
      const data = await res.json();
      if (res.status === 403 && data.code === 40301) {
        setNeedsUnlock(true);
        setItems([]);
        return;
      }
      setNeedsUnlock(false);
      setItems(data.data || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  const handleUnlock = async () => {
    if (!totpCode.trim()) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/admin/vault/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "验证失败");
      setTotpCode("");
      setNeedsUnlock(false);
      await loadItems(typeFilter, search);
    } catch (e) {
      alert(e instanceof Error ? e.message : "验证失败");
    }
    setUnlocking(false);
  };

  useEffect(() => {
    fetch("/api/admin/vault/verify")
      .then((r) => r.json())
      .then((d) => setTotpConfigured(Boolean(d.data?.totpConfigured)))
      .catch(() => setTotpConfigured(false));
    loadItems(typeFilter, search);
  }, [typeFilter, loadItems]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowSecret(false);
    setEditorOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/vault/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const detail = data.data as VaultDetail;
      setEditingId(id);
      setForm({
        title: detail.title,
        type: detail.type,
        account: detail.account || "",
        secret: detail.secret || "",
        url: detail.url || "",
        content: detail.content || "",
        remark: detail.remark || "",
        pinned: detail.pinned,
      });
      setShowSecret(false);
      setEditorOpen(true);
    } catch {
      alert("加载详情失败");
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowSecret(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert("请填写标题");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        account: form.account || null,
        secret: form.secret || null,
        url: form.url || null,
        content: form.content || null,
        remark: form.remark || null,
      };
      const res = await fetch(editingId ? `/api/admin/vault/${editingId}` : "/api/admin/vault", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "保存失败");
      closeEditor();
      loadItems(typeFilter, search);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/vault/${id}`, { method: "DELETE" });
      loadItems(typeFilter, search);
    });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="admin-page">
      {totpConfigured && needsUnlock && (
        <div className="admin-card" style={{ marginBottom: 16, padding: 16 }}>
          <p style={{ margin: "0 0 12px", color: "var(--text-secondary)" }}>
            访问私密笔记前请输入 Authenticator 中的 6 位验证码（15 分钟内有效）
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ width: 140, letterSpacing: "0.2em" }}
            />
            <button type="button" className="admin-btn primary" onClick={handleUnlock} disabled={unlocking}>
              {unlocking ? "验证中..." : "解锁"}
            </button>
          </div>
        </div>
      )}

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">
            <Lock size={20} style={{ display: "inline", marginRight: 8, verticalAlign: "-3px" }} />
            私密笔记
          </h1>
          <p className="admin-page-desc">仅管理员可访问，密码与保密内容加密存储</p>
        </div>
        <button type="button" className="admin-btn primary" onClick={openCreate}>
          <Plus size={15} />
          新建记录
        </button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filter-chips">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`admin-chip ${typeFilter === f.id ? "active" : ""}`}
              onClick={() => setTypeFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="admin-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="搜索标题、账号、备注…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadItems(typeFilter, search)}
          />
          <button type="button" className="admin-btn ghost" onClick={() => loadItems(typeFilter, search)}>
            搜索
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">加载中…</div>
      ) : items.length === 0 ? (
        <EmptyState title="暂无私密记录" description="点击「新建记录」保存账号、密码或保密文章" />
      ) : (
        <div className="data-panel">
          <div className="vault-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>类型</th>
                  <th>账号</th>
                  <th>链接</th>
                  <th>敏感字段</th>
                  <th>更新</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.pinned ? <Pin size={12} style={{ marginRight: 4, opacity: 0.7 }} /> : null}
                      <button type="button" className="vault-link-btn" onClick={() => openEdit(item.id)}>
                        {item.title}
                      </button>
                    </td>
                    <td>
                      <span className="admin-badge">{VAULT_TYPE_LABELS[item.type]}</span>
                    </td>
                    <td className="mono">{item.account || "—"}</td>
                    <td>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="vault-ext-link">
                          打开
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {item.hasSecret ? "密码/密钥" : ""}
                      {item.hasSecret && item.hasContent ? " · " : ""}
                      {item.hasContent ? "正文" : ""}
                      {!item.hasSecret && !item.hasContent ? "—" : ""}
                    </td>
                    <td className="text-muted text-xs">
                      {new Date(item.updatedAt).toLocaleString("zh-CN")}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="icon-btn" onClick={() => openEdit(item.id)} title="编辑">
                          编辑
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(item.id, item.title)}
                          disabled={isPending}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editorOpen ? (
        <div className="vault-editor-overlay" role="dialog" aria-modal="true">
          <div className="vault-editor-panel">
            <div className="vault-editor-header">
              <h2>{editingId ? "编辑私密记录" : "新建私密记录"}</h2>
              <button type="button" className="icon-btn" onClick={closeEditor} aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="vault-editor-body">
              <label className="form-field">
                <span>标题 *</span>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  maxLength={200}
                />
              </label>

              <label className="form-field">
                <span>类型</span>
                <select
                  className="form-input"
                  value={form.type}
                  onChange={(e) => update("type", e.target.value as VaultEntryType)}
                >
                  <option value="ACCOUNT">账号密码</option>
                  <option value="SECRET">密钥令牌</option>
                  <option value="NOTE">保密笔记</option>
                </select>
              </label>

              {(form.type === "ACCOUNT" || form.type === "SECRET") && (
                <label className="form-field">
                  <span>账号 / 标识</span>
                  <input
                    className="form-input"
                    value={form.account}
                    onChange={(e) => update("account", e.target.value)}
                    placeholder="用户名、邮箱、App ID…"
                  />
                </label>
              )}

              <label className="form-field">
                <span>{form.type === "NOTE" ? "访问链接（可选）" : "相关链接"}</span>
                <input
                  className="form-input"
                  type="url"
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  placeholder="https://"
                />
              </label>

              <label className="form-field">
                <span>{form.type === "SECRET" ? "密钥 / Token" : form.type === "ACCOUNT" ? "密码" : "敏感信息（可选）"}</span>
                <div className="vault-secret-row">
                  <input
                    className="form-input mono"
                    type={showSecret ? "text" : "password"}
                    value={form.secret}
                    onChange={(e) => update("secret", e.target.value)}
                    placeholder={editingId && form.secret ? "留空则保持原密码" : ""}
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowSecret((v) => !v)}>
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => copyText(form.secret)} title="复制">
                    <Copy size={16} />
                  </button>
                </div>
              </label>

              <label className="form-field">
                <span>保密正文 / 文章</span>
                <textarea
                  className="form-input form-textarea vault-content-area"
                  value={form.content}
                  onChange={(e) => update("content", e.target.value)}
                  rows={10}
                  placeholder="可写长文、配置说明、私密文章…"
                />
              </label>

              <label className="form-field">
                <span>备注</span>
                <input
                  className="form-input"
                  value={form.remark}
                  onChange={(e) => update("remark", e.target.value)}
                  maxLength={500}
                />
              </label>

              <label className="form-check">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => update("pinned", e.target.checked)}
                />
                置顶
              </label>
            </div>

            <div className="vault-editor-footer">
              <button type="button" className="admin-btn ghost" onClick={closeEditor}>
                取消
              </button>
              <button type="button" className="admin-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}