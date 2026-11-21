"use client";

import { useEffect, useState } from "react";
import { Headphones, Loader2, PlugZap, Save } from "lucide-react";
import { MIMO_API_BASE_URL, mimoApiKeyError } from "@/lib/ai/mimo-config";
import {
  MIMO_ROLE_MODELS, MIMO_TTS_VOICES, readerSpeechLabels,
  type AdminReaderSpeechSettings, type ReaderSpeechSettings,
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
  const [keyConfigured, setKeyConfigured] = useState(initialKeyConfigured);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [operation, setOperation] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyError = mimoApiKeyError(apiKey);
  const title = readerSpeechLabels[draft.service];
  const prefix = "reader-speech-" + draft.service;
  const ready = draft.enabled && (Boolean(apiKey.trim()) || (keyConfigured && !clearApiKey));

  const submit = async (action: "save" | "test") => {
    setError(null);
    setOperation(action);
    try {
      const response = await fetch(action === "save" ? settingsPath : settingsPath + "/test", {
        method: action === "save" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, apiKey, clearApiKey }),
      });
      if (action === "save") {
        const saved = await readSettingsResponse<AdminReaderSpeechSettings>(response, "保存失败");
        const { keyConfigured: configured, ...savedSettings } = saved;
        setDraft(savedSettings);
        setKeyConfigured(configured);
        setApiKey("");
        setClearApiKey(false);
        onNotify(title + "配置已保存");
      } else {
        const probe = await readSettingsResponse<{ latencyMs: number }>(response, "连接测试失败");
        onNotify(title + "连接成功（" + probe.latencyMs + " ms）");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "请求失败");
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
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />
        启用{title}
      </label>
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-model"}>模型</label>
        {draft.service === "roles" ? (
          <select
            id={prefix + "-model"}
            className="form-input"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value as typeof draft.model })}
          >
            {MIMO_ROLE_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        ) : <output id={prefix + "-model"}>{draft.model}</output>}
      </div>
      {draft.service === "tts" && (
        <div className="form-field">
          <label className="form-field-label" htmlFor={prefix + "-voice"}>默认音色</label>
          <select
            id={prefix + "-voice"}
            className="form-input"
            value={draft.voice}
            onChange={(event) => setDraft({ ...draft, voice: event.target.value as typeof draft.voice })}
          >
            {MIMO_TTS_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
          </select>
        </div>
      )}
      <div className="form-field">
        <label className="form-field-label" htmlFor={prefix + "-key"}>
          API Key <span className="form-field-hint">{keyConfigured ? "已配置，留空可保留" : "小米 MiMo 按量付费 Key"}</span>
        </label>
        <input
          id={prefix + "-key"}
          className="form-input"
          type="password"
          autoComplete="new-password"
          maxLength={512}
          placeholder={keyConfigured ? undefined : "sk-…"}
          aria-invalid={Boolean(keyError)}
          aria-describedby={keyError ? prefix + "-key-error" : undefined}
          disabled={clearApiKey}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setError(null);
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button" className="primary-button" onClick={() => void submit("save")}
          disabled={Boolean(keyError) || (draft.enabled && !ready)}
        >
          {operation === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          保存{title}
        </button>
        <button
          type="button" className="secondary-button" onClick={() => void submit("test")}
          disabled={Boolean(keyError) || clearApiKey || (!keyConfigured && !apiKey.trim())}
        >
          {operation === "test" ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
          测试{title}
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
        <span className="data-panel-meta">小米 MiMo</span>
      </div>
      {status === "loading" && <p className="data-panel-loading">加载听书服务…</p>}
      {status === "error" && <p className="settings-form" role="alert">加载听书服务失败，请刷新后重试。</p>}
      {status === "ready" && (
        <>
          <p className="settings-form">在小米开放平台的 API Keys 页面创建按量 Key。填入后可先测试连接，成功后勾选启用并保存。<br /><code>{MIMO_API_BASE_URL}</code></p>
          <div className="grid gap-4 md:grid-cols-2">
            {settings.map((item) => <ServiceForm key={item.service} initial={item} onNotify={onNotify} />)}
          </div>
        </>
      )}
    </section>
  );
}
