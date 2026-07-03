"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type CardPackageRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  intro?: string | null;
  highlights?: string[] | null;
  usageSteps?: string[] | null;
  cardType: string;
  cardValue: number;
  price: number;
  badge: string;
  accent: string;
  cover?: string | null;
  enabled: boolean;
  published: boolean;
  sortOrder: number;
  stock?: number;
};

type EditorForm = {
  name: string;
  description: string;
  intro: string;
  highlightsText: string;
  usageStepsText: string;
  price: string;
  badge: string;
  accent: string;
  cover: string;
  published: boolean;
};

type Props = {
  pkg: CardPackageRecord | null;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description: string;
    intro: string | null;
    highlights: string[];
    usageSteps: string[];
    price: number;
    badge: string;
    accent: string;
    cover: string | null;
    published: boolean;
  }) => void;
};

function linesToArray(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value?: string[] | null) {
  return (value || []).join("\n");
}

export function CardPackageEditor({ pkg, open, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<EditorForm>({
    name: "",
    description: "",
    intro: "",
    highlightsText: "",
    usageStepsText: "",
    price: "",
    badge: "NEW",
    accent: "gold",
    cover: "",
    published: false,
  });

  useEffect(() => {
    if (!pkg || !open) return;
    setForm({
      name: pkg.name,
      description: pkg.description,
      intro: pkg.intro || "",
      highlightsText: arrayToLines(pkg.highlights as string[] | null),
      usageStepsText: arrayToLines(pkg.usageSteps as string[] | null),
      price: String(pkg.price),
      badge: pkg.badge,
      accent: pkg.accent,
      cover: pkg.cover || "",
      published: pkg.published,
    });
  }, [pkg, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !pkg) return null;

  const submit = (publish?: boolean) => {
    const price = parseFloat(form.price);
    if (!form.name.trim() || !form.description.trim() || !Number.isFinite(price) || price <= 0) {
      return;
    }
    onSave({
      name: form.name.trim(),
      description: form.description.trim(),
      intro: form.intro.trim() || null,
      highlights: linesToArray(form.highlightsText),
      usageSteps: linesToArray(form.usageStepsText),
      price,
      badge: form.badge.trim() || "NEW",
      accent: form.accent.trim() || "gold",
      cover: form.cover.trim() || null,
      published: publish ?? form.published,
    });
  };

  return (
    <div className="product-detail-overlay" role="dialog" aria-modal="true" aria-label="编辑卡密商品">
      <button type="button" className="product-detail-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="product-detail-modal card-package-editor">
        <div className="product-detail-body" style={{ paddingTop: 22 }}>
          <div className="product-detail-header">
            <div>
              <span className="product-detail-category">卡密商品 · {pkg.slug}</span>
              <h2 className="product-detail-title">编辑介绍与发布设置</h2>
              <p className="product-detail-summary">
                库存 {pkg.stock ?? 0} · {pkg.cardType} / {pkg.cardValue}
                {pkg.published ? " · 已发布到商店" : " · 未发布"}
              </p>
            </div>
            <button type="button" className="product-detail-close" onClick={onClose} aria-label="关闭">
              <X size={18} />
            </button>
          </div>

          <div className="admin-form-grid" style={{ marginBottom: 16 }}>
            <div className="admin-form-group full">
              <label className="admin-form-label">商品名称</label>
              <input
                className="admin-form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="admin-form-group full">
              <label className="admin-form-label">一句话简介（卡片摘要）</label>
              <input
                className="admin-form-input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="显示在商品卡片上的短描述"
              />
            </div>
            <div className="admin-form-group full">
              <label className="admin-form-label">详细介绍（详情弹窗）</label>
              <textarea
                className="admin-form-textarea"
                rows={5}
                value={form.intro}
                onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
                placeholder="支持多段，空行分段显示"
              />
            </div>
            <div className="admin-form-group full">
              <label className="admin-form-label">亮点（每行一条）</label>
              <textarea
                className="admin-form-textarea"
                rows={4}
                value={form.highlightsText}
                onChange={(e) => setForm((f) => ({ ...f, highlightsText: e.target.value }))}
                placeholder="兑换即开通，无需人工审核"
              />
            </div>
            <div className="admin-form-group full">
              <label className="admin-form-label">使用步骤（每行一步）</label>
              <textarea
                className="admin-form-textarea"
                rows={4}
                value={form.usageStepsText}
                onChange={(e) => setForm((f) => ({ ...f, usageStepsText: e.target.value }))}
                placeholder="登录个人中心 → 卡密兑换 → 输入卡号卡密"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">售价 (¥)</label>
              <input
                className="admin-form-input"
                type="number"
                min={0.01}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">角标</label>
              <input
                className="admin-form-input"
                value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                placeholder="HOT / NEW / LOW"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">主题色</label>
              <select
                className="admin-form-select"
                value={form.accent}
                onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value }))}
              >
                <option value="gold">gold</option>
                <option value="teal">teal</option>
                <option value="blue">blue</option>
                <option value="rose">rose</option>
                <option value="orange">orange</option>
              </select>
            </div>
            <div className="admin-form-group full">
              <label className="admin-form-label">封面样式（CSS background）</label>
              <input
                className="admin-form-input mono"
                value={form.cover}
                onChange={(e) => setForm((f) => ({ ...f, cover: e.target.value }))}
                placeholder="linear-gradient(...), url('...')"
              />
            </div>
          </div>

          <div className="card-package-editor-actions">
            <label className="card-package-publish-toggle">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              />
              发布到前台商店
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                disabled={saving}
                onClick={() => submit(false)}
              >
                保存草稿
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-accent admin-btn-sm"
                disabled={saving}
                onClick={() => submit(true)}
              >
                {saving ? "保存中..." : "保存并发布"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}