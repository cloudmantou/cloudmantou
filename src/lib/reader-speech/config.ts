export const MIMO_API_BASE_URL = "https://api.xiaomimimo.com/v1";
export const MIMO_ROLE_MODELS = ["mimo-v2.6-flash", "mimo-v2.6-pro"] as const;
export const MIMO_TTS_MODEL = "mimo-v2.5-tts";
export const MIMO_TTS_VOICES = [
  "苏打", "冰糖", "茉莉", "白桦", "mimo_default", "Mia", "Chloe", "Milo", "Dean",
] as const;

export const READER_SPEECH_SERVICES = ["roles", "tts"] as const;
export type ReaderSpeechService = typeof READER_SPEECH_SERVICES[number];

export const readerSpeechLabels = { roles: "AI 角色识别", tts: "官方语音合成" } as const;

export type ReaderSpeechSettings = {
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
    ? { service, enabled: false, model: MIMO_ROLE_MODELS[0], dailyLimit: 100 }
    : { service, enabled: false, model: MIMO_TTS_MODEL, voice: "苏打", dailyLimit: 1_000 };
}
