"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, PlugZap, Save } from "lucide-react";
import {
  AI_PROVIDER_PRESETS,
  getAiProviderPreset,
  type AiProviderPresetId,
} from "@/lib/ai/presets";

type AiSettingsState = {
  mode: "environment" | "database";
  enabled: boolean;
  preset: AiProviderPresetId;
  providerType: "openai-compatible" | "anthropic-compatible";
  providerName: string;
  baseURL: string;
  apiKey: string;
  clearApiKey: boolean;
  textModel: string;
  supportsStructuredOutputs: boolean;
  requestTimeoutMs: number;
  openAiAuthMode: "bearer" | "api-key";
  anthropicAuthMode: "auth-token" | "api-key";
  apiKeyConfigured: boolean;
  status: "ready" | "disabled" | "incomplete" | "invalid";
};

type Notify = (text: string, type?: "ok" | "err") => void;

const DEFAULT_PRESET = getAiProviderPreset("minimax");
const DEFAULT_SETTINGS: AiSettingsState = {
  mode: "environment",
  enabled: false,
  preset: DEFAULT_PRESET.id,
  providerType: DEFAULT_PRESET.providerType,
  providerName: DEFAULT_PRESET.providerName,
  baseURL: DEFAULT_PRESET.baseURL,
  apiKey: "",
  clearApiKey: false,
  textModel: DEFAULT_PRESET.textModel,
  supportsStructuredOutputs: DEFAULT_PRESET.supportsStructuredOutputs,
  requestTimeoutMs: 120_000,
  openAiAuthMode: DEFAULT_PRESET.openAiAuthMode,
  anthropicAuthMode: DEFAULT_PRESET.anthropicAuthMode,
  apiKeyConfigured: false,
  status: "disabled",
};

function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <div className="form-field-label">
        {label}
        {hint ? <span className="form-field-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function AiSettingsEditor({ onNotify }: { onNotify: Notify }) {
  const [settings, setSettings] = useState<AiSettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/admin/settings/ai");
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.data) throw new Error(body?.message || "加载 AI 设置失败");
    setSettings((previous) => ({
      ...previous,
      ...body.data,
      apiKey: "",
      clearApiKey: false,
    }));
  }, []);

  useEffect(() => {
    loadSettings()
      .catch((error) => onNotify(error instanceof Error ? error.message : "加载 AI 设置失败", "err"))
      .finally(() => setLoading(false));
  }, [loadSettings, onNotify]);

  const update = <Key extends keyof AiSettingsState>(key: Key, value: AiSettingsState[Key]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const applyPreset = (presetId: AiProviderPresetId) => {
    const preset = getAiProviderPreset(presetId);
    setSettings((previous) => ({
      ...previous,
      preset: preset.id,
      providerType: preset.providerType,
      providerName: preset.providerName,
      baseURL: preset.baseURL,
      textModel: preset.textModel,
      supportsStructuredOutputs: preset.supportsStructuredOutputs,
      openAiAuthMode: preset.openAiAuthMode,
      anthropicAuthMode: preset.anthropicAuthMode,
      apiKey: "",
      apiKeyConfigured: false,
      clearApiKey: false,
      status: previous.enabled ? "incomplete" : "disabled",
    }));
  };

  const buildPayload = () => ({
      mode: settings.mode,
      enabled: settings.enabled,
      preset: settings.preset,
      providerType: settings.providerType,
      providerName: settings.providerName,
      baseURL: settings.baseURL,
      apiKey: settings.apiKey,
      clearApiKey: settings.clearApiKey,
      textModel: settings.textModel,
      supportsStructuredOutputs: settings.supportsStructuredOutputs,
      requestTimeoutMs: settings.requestTimeoutMs,
      openAiAuthMode: settings.openAiAuthMode,
      anthropicAuthMode: settings.anthropicAuthMode,
    });

  const persistSettings = async (payload = buildPayload()) => {
    const response = await fetch("/api/admin/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "保存 AI 设置失败");
    await loadSettings();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistSettings();
      onNotify("AI 设置已保存");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存 AI 设置失败", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const payload = buildPayload();
      const response = await fetch("/api/admin/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "模型连接测试失败");
      await persistSettings(payload);
      onNotify(`连接成功：${body.data.provider} / ${body.data.model}（${body.data.latencyMs}ms）`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "模型连接测试失败", "err");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <section className="data-panel ai-settings-panel">
        <div className="data-panel-loading"><Loader2 size={14} className="animate-spin" /> 加载 AI 设置…</div>
      </section>
    );
  }

  const databaseMode = settings.mode === "database";
  const statusLabel = settings.status === "ready"
    ? "已就绪"
    : settings.status === "disabled"
      ? "未启用"
      : settings.status === "incomplete"
        ? "待配置"
        : "配置异常";

  return (
    <section className="data-panel ai-settings-panel">
      <div className="data-panel-header">
        <span className="data-panel-title"><Bot size={14} aria-hidden="true" /> AI 模型</span>
        <span className={`ai-settings-status is-${settings.status}`}>{statusLabel}</span>
      </div>
      <div className="ai-settings-intro">
        支持 DeepSeek、小米 MiMo、MiniMax，以及任意 OpenAI / Anthropic 兼容接口。API Key 仅在服务端加密保存，页面只显示配置状态。
      </div>
      <div className="settings-form ai-settings-form">
        <Field label="配置来源" hint="后台配置保存到数据库并覆盖服务器环境变量">
          <select
            value={settings.mode}
            onChange={(event) => {
              const mode = event.target.value as AiSettingsState["mode"];
              setSettings((previous) => ({
                ...previous,
                mode,
                ...(mode === "database" && previous.mode !== "database"
                  ? { apiKeyConfigured: false, status: previous.enabled ? "incomplete" : "disabled" }
                  : {}),
              }));
            }}
            className="form-input"
          >
            <option value="environment">服务器环境变量</option>
            <option value="database">系统设置（加密保存）</option>
          </select>
        </Field>
        <Field label="模型厂商" hint="选择预设后仍可调整接口地址和模型 ID">
          <select
            value={settings.preset}
            onChange={(event) => applyPreset(event.target.value as AiProviderPresetId)}
            className="form-input"
            disabled={!databaseMode}
          >
            {AI_PROVIDER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label} — {preset.description}</option>
            ))}
          </select>
        </Field>
        <Field label="兼容协议" hint="由服务商接口格式决定">
          <select
            value={settings.providerType}
            onChange={(event) => setSettings((previous) => ({
              ...previous,
              providerType: event.target.value as AiSettingsState["providerType"],
              apiKey: "",
              apiKeyConfigured: false,
              status: previous.enabled ? "incomplete" : "disabled",
            }))}
            className="form-input"
            disabled={!databaseMode}
          >
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="anthropic-compatible">Anthropic Compatible</option>
          </select>
        </Field>
        <Field label="Provider 名称" hint="用于日志和 AI SDK Provider 标识">
          <input type="text" value={settings.providerName} onChange={(event) => update("providerName", event.target.value)} className="form-input mono" disabled={!databaseMode} maxLength={64} />
        </Field>
        <Field label="Base URL" hint="系统设置仅允许标准 HTTPS 公网接口；本机代理请继续使用服务器环境变量">
          <input type="url" value={settings.baseURL} onChange={(event) => setSettings((previous) => ({ ...previous, baseURL: event.target.value, apiKey: "", apiKeyConfigured: false, status: previous.enabled ? "incomplete" : "disabled" }))} className="form-input mono" disabled={!databaseMode} maxLength={500} />
        </Field>
        <Field label="模型 ID" hint="例如 deepseek-v4-flash、mimo-v2.5-pro、MiniMax-M3">
          <input type="text" value={settings.textModel} onChange={(event) => update("textModel", event.target.value)} className="form-input mono" disabled={!databaseMode} maxLength={200} />
        </Field>
        <Field label="API Key" hint={settings.apiKeyConfigured ? "已配置；留空保留原密钥，输入新值可轮换" : "后台模式启用前必须填写"}>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => setSettings((previous) => ({ ...previous, apiKey: event.target.value, clearApiKey: false }))}
            className="form-input mono"
            disabled={!databaseMode}
            autoComplete="new-password"
            maxLength={512}
            placeholder={settings.apiKeyConfigured ? "••••••••••••（已加密保存）" : "sk-..."}
          />
        </Field>
        <Field label="认证方式" hint="MiMo 默认 api-key；DeepSeek 默认 Bearer；MiniMax Anthropic 默认 Auth Token">
          {settings.providerType === "openai-compatible" ? (
            <select value={settings.openAiAuthMode} onChange={(event) => setSettings((previous) => ({ ...previous, openAiAuthMode: event.target.value as AiSettingsState["openAiAuthMode"], apiKey: "", apiKeyConfigured: false, status: previous.enabled ? "incomplete" : "disabled" }))} className="form-input" disabled={!databaseMode}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="api-key">api-key</option>
            </select>
          ) : (
            <select value={settings.anthropicAuthMode} onChange={(event) => setSettings((previous) => ({ ...previous, anthropicAuthMode: event.target.value as AiSettingsState["anthropicAuthMode"], apiKey: "", apiKeyConfigured: false, status: previous.enabled ? "incomplete" : "disabled" }))} className="form-input" disabled={!databaseMode}>
              <option value="auth-token">Authorization: Bearer</option>
              <option value="api-key">x-api-key</option>
            </select>
          )}
        </Field>
        <Field label="请求超时" hint="5–300 秒；长文优化建议 120 秒以上">
          <input type="number" min={5} max={300} value={Math.round(settings.requestTimeoutMs / 1000)} onChange={(event) => update("requestTimeoutMs", Number(event.target.value) * 1000)} className="form-input mono" disabled={!databaseMode} />
        </Field>
      </div>
      <div className="toggle-list">
        <div className="toggle-row">
          <div className="toggle-meta">
            <div className="toggle-label">启用 AI 编辑助手</div>
            <div className="toggle-desc">用于标题、摘要、SEO 元数据和文章优化；关闭后不发起模型请求</div>
          </div>
          <button type="button" onClick={() => update("enabled", !settings.enabled)} className={`switch${settings.enabled ? " on" : ""}`} aria-pressed={settings.enabled} aria-label="启用 AI 编辑助手" disabled={!databaseMode}>
            <span className="switch-knob" />
          </button>
        </div>
        <div className="toggle-row">
          <div className="toggle-meta">
            <div className="toggle-label">结构化输出</div>
            <div className="toggle-desc">Provider 支持时生成严格的标题、摘要与 SEO 字段结构</div>
          </div>
          <button type="button" onClick={() => update("supportsStructuredOutputs", !settings.supportsStructuredOutputs)} className={`switch${settings.supportsStructuredOutputs ? " on" : ""}`} aria-pressed={settings.supportsStructuredOutputs} aria-label="启用结构化输出" disabled={!databaseMode}>
            <span className="switch-knob" />
          </button>
        </div>
      </div>
      <div className="ai-settings-actions">
        <span>{databaseMode ? "测试连接会先发送一条最小请求，成功后再保存当前配置。" : "当前读取服务器 .env；切换为系统设置后可在线配置。"}</span>
        <div className="ai-settings-action-buttons">
          <button type="button" className="secondary-button" onClick={handleSave} disabled={saving || testing}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "保存中…" : "保存 AI 设置"}
          </button>
          <button type="button" className="secondary-button" onClick={handleTest} disabled={saving || testing || !settings.enabled}>
            {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
            {testing ? "测试中…" : "保存并测试连接"}
          </button>
        </div>
      </div>
    </section>
  );
}
