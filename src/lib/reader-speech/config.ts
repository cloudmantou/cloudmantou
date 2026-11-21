import { MIMO_API_BASE_URL, MIMO_TOKEN_PLAN_ERROR, isMimoApiURL, mimoApiKeyError } from "@/lib/ai/mimo-config";

export const MIMO_ROLE_MODELS = ["mimo-v2.6-flash", "mimo-v2.6-pro"] as const;
export const MIMO_TTS_MODEL = "mimo-v2.5-tts";
export const MIMO_TTS_VOICES = [
  "苏打", "冰糖", "茉莉", "白桦", "mimo_default", "Mia", "Chloe", "Milo", "Dean",
] as const;

export const READER_SPEECH_SERVICES = ["roles", "tts"] as const;
export type ReaderSpeechService = typeof READER_SPEECH_SERVICES[number];

export const readerSpeechLabels = { roles: "AI 角色识别", tts: "官方语音合成" } as const;

export type ReaderSpeechSettings = {
  baseURL: string;
  enabled: boolean;
  dailyLimit: number;
} & (
  | { service: "roles"; model: typeof MIMO_ROLE_MODELS[number] }
  | { service: "tts"; model: typeof MIMO_TTS_MODEL; voice: typeof MIMO_TTS_VOICES[number] }
);

export type AdminReaderSpeechSettings = ReaderSpeechSettings & { keyConfigured: boolean };
export type ReaderSpeechCredentials = ReaderSpeechSettings & { apiKey: string };

export function defaultReaderSpeechSettings(service: ReaderSpeechService): ReaderSpeechSettings {
  return service === "roles"
    ? { service, baseURL: MIMO_API_BASE_URL, enabled: false, model: MIMO_ROLE_MODELS[0], dailyLimit: 100 }
    : { service, baseURL: MIMO_API_BASE_URL, enabled: false, model: MIMO_TTS_MODEL, voice: "苏打", dailyLimit: 1_000 };
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
  const path = url.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  url.pathname = path || (isMimoApiURL(url.origin) ? "/v1" : "/");
  return url.href.replace(/\/$/, "");
}

export function readerSpeechApiKeyError(baseURL: string, apiKey: string): string | undefined {
  const key = apiKey.trim();
  if (!key) return undefined;
  if (/^(?:tp|ttp)-/.test(key)) return MIMO_TOKEN_PLAN_ERROR;
  if (isMimoApiURL(baseURL)) return mimoApiKeyError(key);
  if (!/^[\x21-\x7e]+$/.test(key)) return "API Key 只能包含可打印 ASCII 字符。";
}
