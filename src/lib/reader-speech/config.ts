import { MIMO_API_BASE_URL, isMimoApiURL, mimoSettingsError } from "@/lib/ai/mimo-config";

export const MIMO_ROLE_MODELS = ["mimo-v2.6-flash", "mimo-v2.6-pro"] as const;
export const MIMO_TTS_MODEL = "mimo-v2.5-tts";
export const MIMO_TTS_VOICES = [
  "苏打", "冰糖", "茉莉", "白桦", "mimo_default", "Mia", "Chloe", "Milo", "Dean",
] as const;

export const READER_SPEECH_SERVICES = ["roles", "tts"] as const;
export const READER_SPEECH_AUTH_MODES = ["bearer", "api-key", "x-api-key"] as const;
export type ReaderSpeechService = typeof READER_SPEECH_SERVICES[number];
export type ReaderSpeechAuthMode = typeof READER_SPEECH_AUTH_MODES[number];

export const readerSpeechLabels = { roles: "AI 角色识别", tts: "语音合成" } as const;

type ProviderPreset<Protocol> = {
  label: string;
  protocol: Protocol;
  baseURL: string;
  model: string;
  authMode: ReaderSpeechAuthMode;
};
type RoleProtocol = "openai-chat" | "anthropic-messages";
type VoiceProtocol = "mimo-tts" | "minimax-tts" | "openai-speech";

export const ROLE_PRESETS = {
  mimo: { label: "小米 MiMo", protocol: "openai-chat", baseURL: MIMO_API_BASE_URL, model: MIMO_ROLE_MODELS[0], authMode: "api-key" },
  deepseek: { label: "DeepSeek", protocol: "openai-chat", baseURL: "https://api.deepseek.com", model: "deepseek-flash", authMode: "bearer" },
  minimax: { label: "MiniMax", protocol: "anthropic-messages", baseURL: "https://api.minimax.cn/anthropic", model: "MiniMax-M3.1-Flash", authMode: "x-api-key" },
  openai: { label: "OpenAI", protocol: "openai-chat", baseURL: "https://api.openai.com/v1", model: "gpt-6-luna", authMode: "bearer" },
  "custom-openai": { label: "自定义 Chat Completions", protocol: "openai-chat", baseURL: "", model: "", authMode: "bearer" },
  "custom-anthropic": { label: "自定义 Anthropic Messages", protocol: "anthropic-messages", baseURL: "", model: "", authMode: "x-api-key" },
} as const satisfies Record<string, ProviderPreset<RoleProtocol>>;

const cosyVoiceModel = "FunAudioLLM/CosyVoice2-0.5B";
const cosyVoiceIDs = ["alex", "anna", "benjamin", "bella", "charles", "claire", "david", "diana"]
  .map((name) => cosyVoiceModel + ":" + name);

export const TTS_PRESETS = {
  mimo: {
    label: "小米 MiMo", protocol: "mimo-tts", baseURL: MIMO_API_BASE_URL, model: MIMO_TTS_MODEL,
    authMode: "api-key", voice: "苏打", voices: MIMO_TTS_VOICES,
  },
  minimax: {
    label: "MiniMax", protocol: "minimax-tts", baseURL: "https://api.minimax.cn/v1", model: "speech-2.8-hd",
    authMode: "bearer", voice: "male-qn-qingse", voices: ["male-qn-qingse", "female-shaonv"],
  },
  siliconflow: {
    label: "硅基流动", protocol: "openai-speech", baseURL: "https://api.siliconflow.cn/v1", model: cosyVoiceModel,
    authMode: "bearer", voice: cosyVoiceModel + ":alex", voices: cosyVoiceIDs,
  },
  "custom-openai": {
    label: "自定义 OpenAI 兼容语音", protocol: "openai-speech", baseURL: "", model: "",
    authMode: "bearer", voice: "", voices: [],
  },
} as const satisfies Record<string, ProviderPreset<VoiceProtocol> & { voice: string; voices: readonly string[] }>;

export type ReaderRoleProvider = keyof typeof ROLE_PRESETS;
export type ReaderTTSProvider = keyof typeof TTS_PRESETS;
export const ROLE_PROVIDER_IDS = Object.keys(ROLE_PRESETS) as ReaderRoleProvider[];
export const TTS_PROVIDER_IDS = Object.keys(TTS_PRESETS) as ReaderTTSProvider[];

type SharedSettings = {
  authMode: ReaderSpeechAuthMode;
  baseURL: string;
  enabled: boolean;
  dailyLimit: number;
  model: string;
};

export type ReaderRoleSettings = SharedSettings & { service: "roles"; provider: ReaderRoleProvider };
export type ReaderTTSSettings = SharedSettings & {
  service: "tts";
  provider: ReaderTTSProvider;
  voice: string;
  additionalVoices: string[];
};
export type ReaderSpeechSettings = ReaderRoleSettings | ReaderTTSSettings;
export type AdminReaderSpeechSettings = ReaderSpeechSettings & { keyConfigured: boolean };
export type ReaderSpeechCredentials = ReaderSpeechSettings & { apiKey: string };

export function defaultReaderSpeechSettings(service: ReaderSpeechService): ReaderSpeechSettings {
  const { baseURL, model, authMode } = service === "roles" ? ROLE_PRESETS.mimo : TTS_PRESETS.mimo;
  const shared = { baseURL, model, authMode, enabled: false, provider: "mimo" } as const;
  return service === "roles"
    ? { ...shared, service, dailyLimit: 100 }
    : { ...shared, service, dailyLimit: 1_000, voice: TTS_PRESETS.mimo.voice, additionalVoices: [] };
}

export function readerSpeechPreset(settings: Pick<ReaderRoleSettings, "service" | "provider"> | Pick<ReaderTTSSettings, "service" | "provider">) {
  return settings.service === "roles" ? ROLE_PRESETS[settings.provider] : TTS_PRESETS[settings.provider];
}

export function readerSpeechVoices(settings: ReaderTTSSettings): string[] {
  const preset = TTS_PRESETS[settings.provider];
  const presetVoices = settings.model === preset.model || settings.provider === "minimax" ? preset.voices : [];
  return [...new Set([...presetVoices, settings.voice, ...settings.additionalVoices].filter(Boolean))];
}

type Connection = Pick<ReaderSpeechSettings, "baseURL" | "authMode" | "provider">;

export function sameReaderSpeechConnection(first: Connection, second: Connection): boolean {
  return first.baseURL === second.baseURL && first.authMode === second.authMode && first.provider === second.provider;
}

export const READER_SPEECH_BASE_URL_ERROR = "Base URL 必须是公网 HTTPS 地址，且不含账号、查询参数或片段。";

export function normalizeReaderSpeechBaseURL(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" || url.port || url.username || url.password || /[?#]/.test(url.href)) {
    return undefined;
  }
  const path = url.pathname.replace(/\/+$/, "").replace(/\/(?:chat\/completions|audio\/speech|t2a_v2|messages)$/, "");
  url.pathname = path || (isMimoApiURL(url.origin) ? "/v1" : "/");
  return url.href.replace(/\/$/, "");
}

export function readerSpeechEndpointError(settings: ReaderSpeechSettings): string | undefined {
  const protocol = readerSpeechPreset(settings).protocol;
  if (isMimoApiURL(settings.baseURL) && settings.service === "tts" && protocol !== "mimo-tts") {
    return "小米官方语音地址需选择「小米 MiMo」语音厂商。";
  }
  const providerType = protocol === "anthropic-messages" ? "anthropic-compatible" : "openai-compatible";
  return mimoSettingsError({ baseURL: settings.baseURL, providerType });
}

export function readerSpeechApiKeyError(_baseURL: string, apiKey: string): string | undefined {
  const key = apiKey.trim();
  if (!key) return undefined;
  if (!/^[\x21-\x7e]+$/.test(key)) return "API Key 只能包含可打印 ASCII 字符。";
}
