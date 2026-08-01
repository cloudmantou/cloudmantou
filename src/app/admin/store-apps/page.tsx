"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  STORE_APP_CATEGORIES,
  STORE_CATEGORY_LABELS,
  type StoreAppCategory,
} from "@/lib/store-apps";

type StoreAppAdmin = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string;
  iconUrl: string | null;
  coverUrl: string | null;
  screenshots: unknown;
  category: StoreAppCategory;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  installUrl: string | null;
  minIos: string | null;
};

type StoreAppForm = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  screenshots: string;
  category: StoreAppCategory;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  installUrl: string;
  minIos: string;
};

const EMPTY_FORM: StoreAppForm = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  iconUrl: "",
  coverUrl: "",
  screenshots: "",
  category: "READING",
  featured: false,
  sortOrder: 0,
  published: false,
  installUrl: "",
  minIos: "",
};

function toForm(app: StoreAppAdmin): StoreAppForm {
  const screenshots = Array.isArray(app.screenshots)
    ? app.screenshots.filter((item): item is string => typeof item === "string").join("\n")
    : "";

  return {
    name: app.name,
    slug: app.slug,
    tagline: app.tagline || "",
    description: app.description,
    iconUrl: app.iconUrl || "",
    coverUrl: app.coverUrl || "",
    screenshots,
    category: app.category,
    featured: app.featured,
    sortOrder: app.sortOrder,
    published: app.published,
    installUrl: app.installUrl || "",
    minIos: app.minIos || "",
  };
}

function requestBody(form: StoreAppForm) {
  return {
    ...form,
    name: form.name.trim(),
    slug: form.slug.trim(),
    tagline: form.tagline.trim() || null,
    description: form.description.trim(),
    iconUrl: form.iconUrl.trim() || null,
    coverUrl: form.coverUrl.trim() || null,
    screenshots: form.screenshots
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    installUrl: form.installUrl.trim() || null,
    minIos: form.minIos.trim() || null,
  };
}

async function apiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message || `操作失败（${response.status}）`;
}

export default function AdminStoreAppsPage() {
  const [apps, setApps] = useState<StoreAppAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StoreAppForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/store-apps", { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      const body = (await response.json()) as { data?: StoreAppAdmin[] };
      setApps(Array.isArray(body.data) ? body.data : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "获取商店应用失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (app: StoreAppAdmin) => {
    setEditingId(app.id);
    setForm(toForm(app));
    setError("");
    setShowForm(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.slug.trim() || !form.description.trim()) {
      setError("名称、slug 和描述不能为空");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          editingId ? `/api/admin/store-apps/${editingId}` : "/api/admin/store-apps",
          {
            method: editingId ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(requestBody(form)),
          }
        );
        if (!response.ok) throw new Error(await apiError(response));
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        await load();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "保存失败");
      }
    });
  };

  const updateState = (app: StoreAppAdmin, data: Partial<Pick<StoreAppAdmin, "published" | "featured" | "sortOrder">>) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/store-apps/${app.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(await apiError(response));
        await load();
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "更新失败");
      }
    });
  };

  const remove = (app: StoreAppAdmin) => {
    if (!window.confirm(`确定删除「${app.name}」？此操作不可撤销。`)) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/store-apps/${app.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await apiError(response));
        await load();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "删除失败");
      }
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>应用商店</h1>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            管理真实应用资料、安装地址、上下架状态与展示顺序。
          </p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--accent)", color: "var(--bg)" }}>
          <Plus size={14} aria-hidden="true" /> 新建应用
        </button>
      </div>

      {error ? <div role="alert" className="mb-4 rounded-lg p-3 text-xs" style={{ background: "var(--rose-dim)", color: "var(--rose)" }}>{error}</div> : null}

      {showForm ? (
        <div className="mb-6 rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>{editingId ? "编辑应用" : "新建应用"}</h2>
            <button type="button" aria-label="关闭表单" onClick={() => setShowForm(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="名称" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
            <TextField label="Slug" value={form.slug} onChange={(slug) => setForm((current) => ({ ...current, slug }))} />
            <TextField label="短介绍" value={form.tagline} onChange={(tagline) => setForm((current) => ({ ...current, tagline }))} />
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              分类
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as StoreAppCategory }))} className="mt-1 w-full rounded-md px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {STORE_APP_CATEGORIES.map((category) => <option key={category} value={category}>{STORE_CATEGORY_LABELS[category]}</option>)}
              </select>
            </label>
            <TextField label="图标地址（HTTPS 或 /uploads/）" value={form.iconUrl} onChange={(iconUrl) => setForm((current) => ({ ...current, iconUrl }))} />
            <TextField label="封面地址（HTTPS 或 /uploads/）" value={form.coverUrl} onChange={(coverUrl) => setForm((current) => ({ ...current, coverUrl }))} />
            <TextField label="安装地址（HTTPS / mantou / itms-services）" value={form.installUrl} onChange={(installUrl) => setForm((current) => ({ ...current, installUrl }))} />
            <TextField label="最低 iOS 版本" value={form.minIos} onChange={(minIos) => setForm((current) => ({ ...current, minIos }))} />
            <label className="text-xs md:col-span-2" style={{ color: "var(--text-muted)" }}>
              描述
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="mt-1 w-full rounded-md px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
            <label className="text-xs md:col-span-2" style={{ color: "var(--text-muted)" }}>
              截图地址（每行一个）
              <textarea value={form.screenshots} onChange={(event) => setForm((current) => ({ ...current, screenshots: event.target.value }))} rows={3} className="mt-1 w-full rounded-md px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
            <TextField label="排序" type="number" value={String(form.sortOrder)} onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder: Number.parseInt(sortOrder, 10) || 0 }))} />
            <div className="flex items-end gap-5 pb-2 text-xs" style={{ color: "var(--text)" }}>
              <CheckField label="精选" checked={form.featured} onChange={(featured) => setForm((current) => ({ ...current, featured }))} />
              <CheckField label="上架" checked={form.published} onChange={(published) => setForm((current) => ({ ...current, published }))} />
            </div>
          </div>
          <button type="button" disabled={isPending} onClick={save} className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs" style={{ background: "var(--accent)", color: "var(--bg)", opacity: isPending ? 0.7 : 1 }}>
            <Save size={14} aria-hidden="true" /> {isPending ? "保存中…" : "保存"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>加载中…</p>
      ) : apps.length === 0 ? (
        <EmptyState title="暂无应用" description="创建第一条真实应用资料后再配置安装地址并上架。" />
      ) : (
        <div className="flex flex-col gap-2">
          {apps.map((app) => (
            <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm" style={{ color: "var(--text)" }}>{app.name}</strong>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/{app.slug}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: app.published ? "var(--teal-dim)" : "var(--card-hover)", color: app.published ? "var(--teal)" : "var(--text-muted)" }}>{app.published ? "已上架" : "未上架"}</span>
                  <span className="text-[10px]" style={{ color: app.installUrl ? "var(--teal)" : "var(--rose)" }}>{app.installUrl ? "已配置安装" : "未配置安装"}</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{STORE_CATEGORY_LABELS[app.category]} · 排序 {app.sortOrder}{app.featured ? " · 精选" : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" disabled={isPending} onClick={() => updateState(app, { published: !app.published })} className="rounded-md px-2 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{app.published ? "下架" : "上架"}</button>
                <button type="button" aria-label={`编辑 ${app.name}`} onClick={() => openEdit(app)} className="rounded-md p-1.5" style={{ color: "var(--text-muted)" }}><Edit size={14} /></button>
                <button type="button" aria-label={`删除 ${app.name}`} disabled={isPending} onClick={() => remove(app)} className="rounded-md p-1.5" style={{ color: "var(--rose)" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" }) {
  return (
    <label className="text-xs" style={{ color: "var(--text-muted)" }}>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
