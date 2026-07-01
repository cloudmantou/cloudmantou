"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Edit, Trash2, Save, X, Hash } from "lucide-react";

type Tag = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
};

type FormData = {
  name: string;
  slug: string;
  color: string;
};

const emptyForm: FormData = { name: "", slug: "", color: "" };

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/admin/tags");
      const data = await res.json();
      setTags(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError("名称和 slug 不能为空");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const url = editing ? `/api/admin/tags/${editing}` : "/api/admin/tags";
        const method = editing ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim(),
            color: form.color.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "操作失败");
        }
        setShowForm(false);
        setEditing(null);
        setForm(emptyForm);
        load();
      } catch (e: any) {
        setError(e.message);
      }
    });
  };

  const handleEdit = (tag: Tag) => {
    setEditing(tag.id);
    setForm({ name: tag.name, slug: tag.slug, color: tag.color || "" });
    setShowForm(true);
    setError("");
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`确定删除标签「${name}」？已关联的文章会失去此标签。`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
      if (res.ok) load();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}>
          标签管理
        </h1>
        <button
          type="button"
          onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); setError(""); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"DM Mono", monospace' }}
        >
          <Plus size={14} aria-hidden="true" />
          新建标签
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              {editing ? "编辑标签" : "新建标签"}
            </h3>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} style={{ color: "var(--text-muted)" }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {error && (
            <div className="mb-3 p-2 rounded text-xs" style={{ background: "rgba(232,99,122,0.1)", color: "var(--rose)" }}>
              {error}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-32 px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-32 px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>颜色 (可选)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color || "#e8b964"}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer"
                  style={{ border: "1px solid var(--border)" }}
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#000000"
                  className="w-24 px-3 py-1.5 rounded-md text-xs outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"DM Mono", monospace', opacity: isPending ? 0.7 : 1 }}
            >
              <Save size={13} aria-hidden="true" />
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* Tag grid */}
      {loading ? (
        <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>暂无标签</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg group"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Hash size={12} style={{ color: tag.color || "var(--accent)" }} aria-hidden="true" />
              <span className="text-sm" style={{ color: "var(--text)" }}>{tag.name}</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
                {tag.postCount}
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                <button type="button" onClick={() => handleEdit(tag)} className="p-1 rounded hover:bg-[var(--card-hover)]" style={{ color: "var(--text-muted)" }}>
                  <Edit size={12} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => handleDelete(tag.id, tag.name)} disabled={isPending} className="p-1 rounded hover:bg-[var(--rose-dim)]" style={{ color: "var(--rose)" }}>
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
