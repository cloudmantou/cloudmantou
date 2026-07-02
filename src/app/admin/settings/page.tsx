"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";

const TIMEZONES = [
  { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "America/New_York", label: "America/New_York (UTC−5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC−8)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (UTC+1)" },
];

const TOGGLES = [
  { key: "openRegistration", label: "开放注册", desc: "允许新用户自主注册账号" },
  { key: "commentReview", label: "评论审核", desc: "新评论需管理员审核后显示" },
  { key: "maintenanceMode", label: "维护模式", desc: "开启后前台显示维护页面" },
] as const;

type ToggleKey = (typeof TOGGLES)[number]["key"];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: "",
    siteSubtitle: "",
    siteDescription: "",
    siteUrl: "",
    adminEmail: "",
    postsPerPage: "10",
    timezone: "Asia/Shanghai",
    openRegistration: true,
    commentReview: true,
    maintenanceMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setSettings((prev) => ({ ...prev, ...d.data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2400);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "保存失败");
      flash("已保存");
    } catch (e: any) {
      flash(e?.message || "保存失败", "err");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>加载中…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="home-greeting">Settings</p>
          <h1 className="page-title">系统设置</h1>
          <p className="page-desc">配置站点基本信息和系统参数。</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="primary-button"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "保存中…" : "保存更改"}
        </button>
      </div>

      <div className="settings-grid">
        {/* Basic Settings */}
        <section className="data-panel">
          <div className="data-panel-header">
            <span className="data-panel-title">基本设置</span>
            <span className="data-panel-meta">站点信息</span>
          </div>
          <div className="settings-form">
            <Field label="站点名称" hint="显示在页面标题与导航">
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => update("siteName", e.target.value)}
                maxLength={100}
                className="form-input"
                placeholder="CloudMantou"
              />
            </Field>
            <Field label="站点副标题" hint="一句话描述站点定位">
              <input
                type="text"
                value={settings.siteSubtitle}
                onChange={(e) => update("siteSubtitle", e.target.value)}
                maxLength={200}
                className="form-input"
                placeholder="博客 · 会员 · 工具"
              />
            </Field>
            <Field label="站点描述" hint="SEO 描述，~160 字符最佳">
              <textarea
                value={settings.siteDescription}
                onChange={(e) => update("siteDescription", e.target.value)}
                rows={3}
                maxLength={1000}
                className="form-input form-textarea"
                placeholder="个人技术博客、会员付费内容与卡密运营平台"
              />
            </Field>
            <Field label="站点 URL" hint="带 https://，用于绝对链接生成">
              <input
                type="url"
                value={settings.siteUrl}
                onChange={(e) => update("siteUrl", e.target.value)}
                className="form-input mono"
                placeholder="https://example.com"
              />
            </Field>
            <Field label="管理员邮箱" hint="接收通知、找回密码">
              <input
                type="email"
                value={settings.adminEmail}
                onChange={(e) => update("adminEmail", e.target.value)}
                className="form-input mono"
                placeholder="admin@example.com"
              />
            </Field>
          </div>
        </section>

        {/* System Parameters */}
        <section className="data-panel">
          <div className="data-panel-header">
            <span className="data-panel-title">系统参数</span>
            <span className="data-panel-meta">运行时配置</span>
          </div>
          <div className="settings-form">
            <Field label="每页文章数" hint="1-50，影响列表分页">
              <input
                type="number"
                value={settings.postsPerPage}
                onChange={(e) => update("postsPerPage", e.target.value)}
                min="1"
                max="50"
                className="form-input mono"
              />
            </Field>
            <Field label="时区" hint="影响所有时间字段的显示与计算">
              <select
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                className="form-input"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="toggle-list">
            {TOGGLES.map((item) => {
              const on = settings[item.key as ToggleKey];
              return (
                <div key={item.key} className="toggle-row">
                  <div className="toggle-meta">
                    <div className="toggle-label">{item.label}</div>
                    <div className="toggle-desc">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => update(item.key, !on)}
                    className={`switch${on ? " on" : ""}`}
                    aria-pressed={on}
                    aria-label={item.label}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {toast && <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>{toast.text}</div>}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <div className="form-field-label">
        {label}
        {hint && <span className="form-field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
