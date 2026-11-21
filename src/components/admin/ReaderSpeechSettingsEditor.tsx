"use client";

import { useEffect, useState } from "react";
import { Headphones, Loader2, PlugZap, Save } from "lucide-react";
import { isMimoApiURL } from "@/lib/ai/mimo-config";
import {
  MIMO_ROLE_MODELS, normalizeReaderSpeechBaseURL, readerSpeechApiKeyError, readerSpeechEndpointError,
  readerSpeechLabels, readerSpeechPreset, readerSpeechVoices, sameReaderSpeechConnection,
  READER_SPEECH_BASE_URL_ERROR, ROLE_PRESETS, TTS_PRESETS,
  type AdminReaderSpeechSettings, type ReaderRoleProvider, type ReaderSpeechAuthMode,
  type ReaderSpeechSettings, type ReaderTTSProvider,
} from "@/lib/reader-speech/config";
import { readApiEnvelope } from "@/lib/client-api-response";

type Notify = (text: string, type?: "ok" | "err") => void;
const settingsPath = "/api/admin/settings/reader-speech";

async function readSettingsResponse<T>(response: Response, message: string): Promise<T> {
  const { data } = await readApiEnvelope(response, message);
  if (data == null) throw new Error(message);
  return data as T;
}

function ServiceForm({ initial, onNotify }: { initial: AdminReaderSpeechSettings; onNotify: Notify }) {
  const { keyConfigured: initialKeyConfigured, ...initialSettings } = initial;
  const [draft, setDraft] = useState<ReaderSpeechSettings>(initialSettings);
  const [savedConnection, setSavedConnection] = useState(initialSettings);
  const [keyConfigured, setKeyConfigured] = useState(initialKeyConfigured);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [additionalVoices, setAdditionalVoices] = useState(initial.service === "tts" ? initial.additionalVoices.join("\n") : "");
  const [operation, setOperation] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const baseURL = normalizeReaderSpeechBaseURL(draft.baseURL);
  const baseURLError = baseURL
    ? readerSpeechEndpointError({ ...draft, baseURL })
    : draft.baseURL.trim() ? READER_SPEECH_BASE_URL_ERROR : undefined;
  const keyError = !baseURLError && baseURL ? readerSpeechApiKeyError(baseURL, apiKey) : undefined;
  const official = baseURL ? isMimoApiURL(baseURL) : false;
  const connectionChanged = !baseURL || !sameReaderSpeechConnection({ ...draft, baseURL }, savedConnection);
  const canReuseKey = keyConfigured && !connectionChanged && !clearApiKey;
  const hasNewKey = Boolean(apiKey.trim());
  const needsKeyForNewConnection = keyConfigured && connectionChanged && !hasNewKey && !clearApiKey;
  const keyHint = connectionChanged && keyConfigured
    ? "连接设置已更改，需填写对应的 Key"
    : canReuseKey ? "已配置，留空可保留" : official ? "小米 MiMo 按量付费 Key" : "服务商 API Key";
  const title = readerSpeechLabels[draft.service];
  const prefix = "reader-speech-" + draft.service;
  const preset = readerSpeechPreset(draft);

  const clearFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const selectProvider = (value: string) => {
    if (draft.service === "roles") {
      const provider = value as ReaderRoleProvider;
      const { baseURL, model, authMode } = ROLE_PRESETS[provider];
      setDraft({ ...draft, provider, baseURL, model, authMode });
    } else {
      const provider = value as ReaderTTSProvider;
      const { baseURL, model, authMode, voice } = TTS_PRESETS[provider];
      setDraft({ ...draft, provider, baseURL, model, authMode, voice, additionalVoices: [] });
      setAdditionalVoices("");
    }
    setApiKey("");
    setClearApiKey(false);
    clearFeedback();
  };

  const validationError = (action: "save" | "test"): string | null => {
    if (!baseURL) return baseURLError ?? READER_SPEECH_BASE_URL_ERROR;
    if (baseURLError) return baseURLError;
    if (keyError) return keyError;
    if (!draft.model.trim()) return "请填写模型 ID。";
    if (draft.service === "tts" && !draft.voice.trim()) return "请填写默认音色 ID。";
    if (!Number.isInteger(draft.dailyLimit) || draft.dailyLimit < 1 || draft.dailyLimit > 100_000) {
      return "全站每日请求上限需为 1–100000 之间的整数。";
    }
    if (action === "test") {
      if (clearApiKey) return "已勾选清除 Key，请先取消后再测试连接。";
      if (!hasNewKey && !canReuseKey) {
        return needsKeyForNewConnection
          ? "更改厂商、Base URL 或认证方式后请填写对应的 API Key。"
          : "请先填写 API Key 再测试连接。";
      }
    } else {
      if (needsKeyForNewConnection) return "更改厂商、Base URL 或认证方式后请填写对应的 API Key。";
      if (draft.enabled && !hasNewKey && !canReuseKey) return "启用服务前请填写 API Key。";
    }
    return null;
  };

  const submit = async (action: "save" | "test") => {
    clearFeedback();
    const issue = validationError(action);
    if (issue) {
      setError(issue);
      onNotify(issue, "err");
      return;
    }
    setOperation(action);
    try {
      const settings = draft.service === "tts"
        ? { ...draft, additionalVoices: additionalVoices.split(/[\n,，]/).map((voice) => voice.trim()).filter(Boolean) }
        : draft;
      const response = await fetch(action === "save" ? settingsPath : settingsPath + "/test", {
        method: action === "save" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, apiKey, clearApiKey }),
      });
      if (action === "save") {
        const saved = await readSettingsResponse<AdminReaderSpeechSettings>(response, "保存失败");
        const { keyConfigured: configured, ...savedSettings } = saved;
        setDraft(savedSettings);
        setSavedConnection(savedSettings);
        if (savedSettings.service === "tts") setAdditionalVoices(savedSettings.additionalVoices.join("\n"));
        setKeyConfigured(configured);
        setApiKey("");
        setClearApiKey(false);
        const message = title + "配置已保存";
        setNotice(message);
        onNotify(message);
      } else {
        const probe = await readSettingsResponse<{ latencyMs: number }>(response, "连接测试失败");
        const message = title + "连接成功（" + probe.latencyMs + " ms）";
        setNotice(message);
        onNotify(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setError(message);
      onNotify(message, "err");
    } finally {
      setOperation(null);
    }
  };

  return (
    <fieldset className="settings-form" disabled={operation !== null}>
      <legend className="data-panel-title">{title}</legend>
      <label className="form-field-label gap-2" style={{ justifyContent: "flex-start" }} htmlFor={prefix + "-enabled"}>
        <input
          id={prefix + "-enabled"}
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => {
            setDraft({ ...draft, enabled: event.target.checked });
            clearFeedback();
          }}
        />
        启用{title}
      </label>
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-provider"}>服务商</label>
        <select id={prefix + "-provider"} className="form-input" value={draft.provider} onChange={(event) => selectProvider(event.target.value)}>
          {Object.entries(draft.service === "roles" ? ROLE_PRESETS : TTS_PRESETS).map(([id, item]) => (
            <option key={id} value={id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-base-url"}>
          Base URL
          <span className="form-field-hint">公网 HTTPS 接口地址</span>
        </label>
        <input
          id={prefix + "-base-url"}
          className="form-input mono"
          type="url"
          maxLength={500}
          placeholder={preset.baseURL || "https://api.example.com/v1"}
          aria-invalid={Boolean(baseURLError)}
          aria-describedby={baseURLError ? prefix + "-url-error" : undefined}
          value={draft.baseURL}
          onChange={(event) => {
            setDraft({ ...draft, baseURL: event.target.value });
            clearFeedback();
          }}
        />
        {baseURLError && <p className="auth-error" id={prefix + "-url-error"} role="alert">{baseURLError}</p>}
      </div>
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-model"}>模型 ID</label>
        <input
          id={prefix + "-model"} className="form-input mono" maxLength={200}
          value={draft.model} placeholder={preset.model || "输入服务商的模型 ID"}
          list={draft.service === "roles" && draft.provider === "mimo" ? prefix + "-models" : undefined}
          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
        />
        {draft.service === "roles" && draft.provider === "mimo" && (
          <datalist id={prefix + "-models"}>{MIMO_ROLE_MODELS.map((model) => <option key={model} value={model} />)}</datalist>
        )}
      </div>
      {draft.service === "tts" && (
        <div className="form-field">
          <label className="form-field-label" htmlFor={prefix + "-voice"}>默认音色 ID</label>
          <input
            id={prefix + "-voice"} className="form-input mono" maxLength={120}
            placeholder="输入或选择音色 ID" value={draft.voice} list={prefix + "-voices"}
            onChange={(event) => setDraft({ ...draft, voice: event.target.value })}
          />
          <datalist id={prefix + "-voices"}>
            {readerSpeechVoices({ ...draft, voice: "" }).map((voice) => <option key={voice} value={voice} />)}
          </datalist>
          <details>
            <summary>添加其他可用音色</summary>
            <label className="form-field-hint" htmlFor={prefix + "-custom-voices"}>每行一个音色 ID，最多 16 个</label>
            <textarea
              id={prefix + "-custom-voices"} className="form-input mono" rows={3}
              value={additionalVoices} onChange={(event) => setAdditionalVoices(event.target.value)}
            />
          </details>
        </div>
      )}
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-auth"}>认证方式</label>
        <select
          id={prefix + "-auth"} className="form-input" value={draft.authMode}
          onChange={(event) => {
            setDraft({ ...draft, authMode: event.target.value as ReaderSpeechAuthMode });
            clearFeedback();
          }}
        >
          <option value="bearer">Authorization: Bearer</option>
          <option value="api-key">api-key</option>
          <option value="x-api-key">x-api-key</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-key"}>
          API Key <span className="form-field-hint">{keyHint}</span>
        </label>
        <input
          id={prefix + "-key"}
          className="form-input"
          type="password"
          autoComplete="new-password"
          maxLength={512}
          placeholder={canReuseKey ? undefined : official ? "sk-…" : "输入服务商 API Key"}
          aria-invalid={Boolean(keyError)}
          aria-describedby={keyError ? prefix + "-key-error" : undefined}
          disabled={clearApiKey}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            clearFeedback();
          }}
        />
        {keyError && <p className="auth-error" id={prefix + "-key-error"} role="alert">{keyError}</p>}
      </div>
      {keyConfigured && (
        <label className="form-field-label gap-2" style={{ justifyContent: "flex-start" }} htmlFor={prefix + "-clear"}>
          <input
            id={prefix + "-clear"}
            type="checkbox"
            checked={clearApiKey}
            onChange={(event) => {
              setClearApiKey(event.target.checked);
              if (event.target.checked) {
                setApiKey("");
                setDraft({ ...draft, enabled: false });
              }
            }}
          />
          清除已保存的 Key
        </label>
      )}
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-limit"}>全站每日请求上限</label>
        <input
          id={prefix + "-limit"}
          className="form-input"
          type="number"
          min={1}
          max={100_000}
          value={draft.dailyLimit}
          onChange={(event) => setDraft({ ...draft, dailyLimit: Number(event.target.value) })}
        />
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && !error && <p className="ai-settings-success" role="status">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button" className="primary-button" onClick={() => void submit("save")}
          disabled={operation !== null}
        >
          {operation === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {operation === "save" ? "保存中…" : "保存" + title}
        </button>
        <button
          type="button" className="secondary-button" onClick={() => void submit("test")}
          disabled={operation !== null}
        >
          {operation === "test" ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
          {operation === "test" ? "测试中…" : "测试" + title}
        </button>
      </div>
    </fieldset>
  );
}

export function ReaderSpeechSettingsEditor({ onNotify }: { onNotify: Notify }) {
  const [settings, setSettings] = useState<AdminReaderSpeechSettings[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(settingsPath, { signal: controller.signal })
      .then((response) => readSettingsResponse<AdminReaderSpeechSettings[]>(response, "加载听书服务失败"))
      .then((saved) => { setSettings(saved); setStatus("ready"); })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  return (
    <section className="data-panel ai-settings-panel" id="reader-speech-settings">
      <div className="data-panel-header">
        <h2 className="data-panel-title"><Headphones size={14} aria-hidden="true" /> 听书服务</h2>
      </div>
      {status === "loading" && <p className="data-panel-loading">加载听书服务…</p>}
      {status === "error" && <p className="settings-form" role="alert">加载听书服务失败，请刷新后重试。</p>}
      {status === "ready" && (
        <>
          <p className="settings-form">两项服务可选择不同厂商。选择预设后，填入对应的 API Key，再测试并保存。</p>
          <div className="grid gap-4 md:grid-cols-2">
            {settings.map((item) => <ServiceForm key={item.service} initial={item} onNotify={onNotify} />)}
          </div>
        </>
      )}
    </section>
  );
}
