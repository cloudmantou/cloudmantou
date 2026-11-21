import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validateAiBaseUrl } from "@/lib/ai/config";
import { MIMO_API_BASE_URL, isMimoApiURL } from "@/lib/ai/mimo-config";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secret-crypto";
import {
  defaultReaderSpeechSettings, normalizeReaderSpeechBaseURL, readerSpeechApiKeyError, readerSpeechEndpointError,
  sameReaderSpeechConnection, READER_SPEECH_AUTH_MODES, READER_SPEECH_BASE_URL_ERROR, READER_SPEECH_SERVICES,
  MIMO_TTS_MODEL, MIMO_TTS_VOICES, ROLE_PRESETS, ROLE_PROVIDER_IDS, TTS_PRESETS, TTS_PROVIDER_IDS,
  type AdminReaderSpeechSettings, type ReaderSpeechCredentials, type ReaderSpeechService, type ReaderSpeechSettings,
} from "@/lib/reader-speech/config";

const keys = {
  roles: "readerSpeechRoles",
  tts: "readerSpeechTts",
} as const;

function allowPublicBaseURL(value: string): string | undefined {
  const normalized = normalizeReaderSpeechBaseURL(value);
  if (!normalized) return undefined;
  try {
    return validateAiBaseUrl(normalized, { allowLoopback: false });
  } catch {
    return undefined;
  }
}

const baseURL = z.string().trim().max(500, "Base URL 最多 500 个字符").transform((value, ctx) => {
  const normalized = allowPublicBaseURL(value);
  if (normalized) return normalized;
  ctx.addIssue({ code: "custom", message: READER_SPEECH_BASE_URL_ERROR });
  return z.NEVER;
});
const shared = {
  baseURL: baseURL.optional(),
  authMode: z.enum(READER_SPEECH_AUTH_MODES).optional(),
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(1).max(100_000),
  model: z.string().trim().min(1, "请填写模型 ID").max(200).regex(/^[\x21-\x7e]+$/, "模型 ID 格式无效"),
};
const voiceID = z.string().trim().min(1, "请填写默认音色 ID").max(120).regex(/^[^\p{Cc}]+$/u, "音色 ID 格式无效");
const roles = z.object({ ...shared, service: z.literal("roles"), provider: z.enum(ROLE_PROVIDER_IDS).optional() }).strict();
const tts = z.object({
  ...shared, service: z.literal("tts"), provider: z.enum(TTS_PROVIDER_IDS).optional(),
  voice: voiceID, additionalVoices: z.array(voiceID).max(16, "最多可添加 16 个音色").optional(),
}).strict();
type Draft = z.infer<typeof roles> | z.infer<typeof tts>;

function legacyAuthMode(url: string) {
  return isMimoApiURL(url) ? "api-key" : "bearer";
}

function fillSettings(input: Draft): ReaderSpeechSettings {
  const provider = input.provider ?? "mimo";
  const preset = input.service === "roles" ? ROLE_PRESETS[input.provider ?? "mimo"] : TTS_PRESETS[input.provider ?? "mimo"];
  const url = input.baseURL ?? preset.baseURL;
  const connection = {
    baseURL: url,
    authMode: input.authMode ?? (provider === "mimo" ? legacyAuthMode(url) : preset.authMode),
    enabled: input.enabled,
    dailyLimit: input.dailyLimit,
    model: input.model,
  };
  if (input.service === "roles") return { ...connection, service: "roles", provider: input.provider ?? "mimo" };
  return {
    ...connection, service: "tts", provider: input.provider ?? "mimo",
    voice: input.voice, additionalVoices: [...new Set(input.additionalVoices ?? [])],
  };
}

const keyFields = { apiKey: z.string().trim().max(512, "API Key 最多 512 个字符"), clearApiKey: z.boolean() };
export const readerSpeechSettingsInput = z.discriminatedUnion("service", [
  roles.extend(keyFields), tts.extend(keyFields),
]).superRefine((input, ctx) => {
  const settings = fillSettings(input);
  const endpointError = settings.baseURL ? readerSpeechEndpointError(settings) : READER_SPEECH_BASE_URL_ERROR;
  if (endpointError) ctx.addIssue({ code: "custom", path: ["baseURL"], message: endpointError });
  const keyError = input.apiKey && input.clearApiKey
    ? "保存新 Key 时请取消清除 Key"
    : readerSpeechApiKeyError(settings.baseURL, input.apiKey);
  if (keyError) ctx.addIssue({ code: "custom", path: ["apiKey"], message: keyError });
  if (settings.service === "tts" && settings.provider === "mimo" && settings.model === MIMO_TTS_MODEL && isMimoApiURL(settings.baseURL)) {
    const officialVoices: readonly string[] = MIMO_TTS_VOICES;
    if ([settings.voice, ...settings.additionalVoices].some((voice) => !officialVoices.includes(voice))) {
      ctx.addIssue({ code: "custom", path: ["voice"], message: "请使用 MiMo 官方预置音色 ID" });
    }
  }
});

const encryptedKey = z.string().refine((value) => !value || isEncryptedSecret(value));
const storedSchema = z.discriminatedUnion("service", [roles.extend({ encryptedKey }), tts.extend({ encryptedKey })]);
type StoredSettings = ReaderSpeechSettings & { encryptedKey: string };
type SettingsInput = z.infer<typeof readerSpeechSettingsInput>;

async function loadSettings(service: ReaderSpeechService) {
  const key = keys[service];
  const row = await prisma.siteSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row) {
    const defaults: StoredSettings = { ...defaultReaderSpeechSettings(service), encryptedKey: "" };
    return { value: null, settings: defaults };
  }
  try {
    const parsed = storedSchema.parse(JSON.parse(row.value));
    const settings = fillSettings(parsed);
    if (settings.service === service && settings.baseURL && !readerSpeechEndpointError(settings)) {
      return { value: row.value, settings: { ...settings, encryptedKey: parsed.encryptedKey } };
    }
  } catch {
    // Invalid data must not be used to contact a provider.
  }
  throw new ApiError("听书服务配置异常", 50311, 503);
}

function publicSettings(stored: StoredSettings): AdminReaderSpeechSettings {
  const { encryptedKey, ...settings } = stored;
  return { ...settings, keyConfigured: Boolean(encryptedKey) };
}

export async function getReaderSpeechSettings(): Promise<AdminReaderSpeechSettings[]> {
  return Promise.all(READER_SPEECH_SERVICES.map(async (service) => publicSettings((await loadSettings(service)).settings)));
}

function staleSettings() {
  return new ApiError("配置已被更新，请重新加载后保存", 40910, 409);
}

function serializeSettings(next: StoredSettings): string {
  const { provider, authMode, baseURL, ...rest } = next;
  const legacyProvider = provider === "mimo" && authMode === legacyAuthMode(baseURL);
  return JSON.stringify({
    ...rest,
    provider: legacyProvider ? undefined : provider,
    authMode: legacyProvider ? undefined : authMode,
    baseURL: legacyProvider && baseURL === MIMO_API_BASE_URL ? undefined : baseURL,
    additionalVoices: next.service === "tts" && next.additionalVoices.length ? next.additionalVoices : undefined,
  });
}

function resolveDraft(input: SettingsInput, saved: ReaderSpeechSettings): ReaderSpeechSettings {
  // Older admin pages cannot confirm a destination or authentication mode they never displayed.
  if ((!input.baseURL && saved.baseURL !== MIMO_API_BASE_URL) ||
      (!input.provider && saved.provider !== "mimo") ||
      (!input.authMode && saved.authMode !== legacyAuthMode(saved.baseURL))) {
    throw staleSettings();
  }
  return fillSettings(input);
}

function requireNewKey() {
  return new ApiError("更改厂商、Base URL 或认证方式后请填写对应的 API Key。", 42211, 422);
}

function validateKey(baseURL: string, apiKey: string) {
  if (isEncryptedSecret(apiKey)) throw new ApiError("请填写服务商提供的原始 API Key。", 42200, 422);
  const message = readerSpeechApiKeyError(baseURL, apiKey);
  if (message) throw new ApiError(message, 42200, 422);
}

export async function saveReaderSpeechSettings(input: SettingsInput): Promise<AdminReaderSpeechSettings> {
  const { apiKey, clearApiKey } = input;
  const previous = await loadSettings(input.service);
  const settings = resolveDraft(input, previous.settings);
  const key = keys[settings.service];
  validateKey(settings.baseURL, apiKey);
  if (!sameReaderSpeechConnection(settings, previous.settings) && previous.settings.encryptedKey && !apiKey && !clearApiKey) {
    throw requireNewKey();
  }
  const next: StoredSettings = {
    ...settings,
    encryptedKey: clearApiKey ? "" : apiKey ? encryptSecret(apiKey) : previous.settings.encryptedKey,
  };
  if (next.enabled && !next.encryptedKey) throw new ApiError("启用服务前请填写 API Key", 42210, 422);
  const value = serializeSettings(next);

  if (previous.value === null) {
    try {
      await prisma.siteSetting.create({ data: { key, value, type: "secret" } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw staleSettings();
      throw error;
    }
  } else {
    const result = await prisma.siteSetting.updateMany({
      where: { key, value: previous.value },
      data: { value },
    });
    if (result.count !== 1) throw staleSettings();
  }
  return publicSettings(next);
}

function credentials(settings: ReaderSpeechSettings, key: string): ReaderSpeechCredentials {
  if (!key) throw new ApiError("听书服务尚未配置 API Key", 50312, 503);
  validateKey(settings.baseURL, key);
  return { ...settings, apiKey: key };
}

export async function resolveReaderSpeechService(service: ReaderSpeechService): Promise<ReaderSpeechCredentials> {
  const { settings: stored } = await loadSettings(service);
  const { encryptedKey, ...settings } = stored;
  if (!settings.enabled) throw new ApiError("该听书服务尚未启用", 50310, 503);
  return credentials(settings, decryptSecret(encryptedKey));
}

export async function resolveReaderSpeechTest(input: SettingsInput): Promise<ReaderSpeechCredentials> {
  const { apiKey, clearApiKey } = input;
  if (apiKey && input.baseURL) return credentials(fillSettings(input), apiKey);
  const { settings: stored } = await loadSettings(input.service);
  const draft = resolveDraft(input, stored);
  if (clearApiKey) return credentials(draft, "");
  if (apiKey) return credentials(draft, apiKey);
  if (!sameReaderSpeechConnection(draft, stored)) throw requireNewKey();
  return credentials(draft, decryptSecret(stored.encryptedKey));
}
