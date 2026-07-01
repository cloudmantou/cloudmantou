"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  postCount: number;
};

type FormData = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

const emptyForm: FormData = { name: "", slug: "", description: "", sortOrder: 0 };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null); // null = new, id = edit
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.data || []);
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
        const url = editing ? `/api/admin/categories/${editing}` : "/api/admin/categories";
        const method = editing ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || null,
            sortOrder: form.sortOrder,
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

  const handleEdit = (cat: Category) => {
    setEditing(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      sortOrder: cat.sortOrder,
    });
    setShowForm(true);
    setError("");
  };

  const handleDelete = (id: string, name: string, postCount: number) => {
    if (postCount > 0) {
      alert(`该分类下有 ${postCount} 篇文章，请先移除`);
      return;
    }
    if (!confirm(`确定删除「${name}」？`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (res.ok) load();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: '"Inter", "PingFang SC", sans-serif', color: "var(--text)" }}>
          分类管理
        </h1>
        <button
          type="button"
          onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); setError(""); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace' }}
        >
          <Plus size={14} aria-hidden="true" />
          新建分类
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              {editing ? "编辑分类" : "新建分类"}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>排序</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace', opacity: isPending ? 0.7 : 1 }}
            >
              <Save size={13} aria-hidden="true" />
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>暂无分类</div>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{cat.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--card-hover)", color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                  /{cat.slug}
                </span>
                {cat.description && (
                  <span className="text-xs truncate max-w-xs" style={{ color: "var(--text-muted)" }}>{cat.description}</span>
                )}
                <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                  {cat.postCount} 篇
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] mr-2" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                  排序: {cat.sortOrder}
                </span>
                <button type="button" onClick={() => handleEdit(cat)} className="p-1.5 rounded-md hover:bg-[var(--card-hover)]" style={{ color: "var(--text-muted)" }}>
                  <Edit size={14} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => handleDelete(cat.id, cat.name, cat.postCount)} disabled={isPending} className="p-1.5 rounded-md hover:bg-[var(--rose-dim)]" style={{ color: "var(--rose)" }}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
