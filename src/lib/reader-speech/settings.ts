import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validateAiBaseUrl } from "@/lib/ai/config";
import { MIMO_API_BASE_URL, mimoSettingsError } from "@/lib/ai/mimo-config";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secret-crypto";
import {
  defaultReaderSpeechSettings, MIMO_ROLE_MODELS, MIMO_TTS_MODEL, MIMO_TTS_VOICES,
  normalizeReaderSpeechBaseURL, readerSpeechApiKeyError, READER_SPEECH_BASE_URL_ERROR, READER_SPEECH_SERVICES,
  type AdminReaderSpeechSettings, type ReaderSpeechCredentials,
  type ReaderSpeechService, type ReaderSpeechSettings,
} from "@/lib/reader-speech/config";

const keys = {
  roles: "readerSpeechRoles",
  tts: "readerSpeechTts",
} as const;

const baseURLSchema = z.string().trim().max(500, "Base URL 最多 500 个字符").transform((value, ctx) => {
  const normalized = normalizeReaderSpeechBaseURL(value);
  if (normalized) {
    try {
      const url = validateAiBaseUrl(normalized, { allowLoopback: false });
      const message = mimoSettingsError({ baseURL: url, providerType: "openai-compatible" });
      if (!message) return url;
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    } catch {
      // Use a safe validation message without echoing a submitted URL.
    }
  }
  ctx.addIssue({ code: "custom", message: READER_SPEECH_BASE_URL_ERROR });
  return z.NEVER;
});

const sharedFields = { enabled: z.boolean(), dailyLimit: z.number().int().min(1).max(100_000) };
const roles = z.object({ ...sharedFields, service: z.literal("roles"), model: z.enum(MIMO_ROLE_MODELS) }).strict();
const tts = z.object({
  ...sharedFields, service: z.literal("tts"), model: z.literal(MIMO_TTS_MODEL), voice: z.enum(MIMO_TTS_VOICES),
}).strict();
const keyFields = {
  baseURL: baseURLSchema.optional(),
  apiKey: z.string().trim().max(512, "API Key 最多 512 个字符"),
  clearApiKey: z.boolean(),
};

export const readerSpeechSettingsInput = z.discriminatedUnion("service", [
  roles.extend(keyFields), tts.extend(keyFields),
]).superRefine(({ baseURL, apiKey, clearApiKey }, ctx) => {
  const message = apiKey && clearApiKey
    ? "保存新 Key 时请取消清除 Key"
    : readerSpeechApiKeyError(baseURL ?? "", apiKey);
  if (message) ctx.addIssue({ code: "custom", path: ["apiKey"], message });
});

const storedFields = {
  baseURL: baseURLSchema.default(MIMO_API_BASE_URL),
  encryptedKey: z.string().refine((value) => !value || isEncryptedSecret(value)),
};
const storedSchema = z.discriminatedUnion("service", [roles.extend(storedFields), tts.extend(storedFields)]);
type StoredSettings = z.infer<typeof storedSchema>;
type SettingsInput = z.infer<typeof readerSpeechSettingsInput>;

async function loadSettings(service: ReaderSpeechService) {
  const key = keys[service];
  const row = await prisma.siteSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row) {
    const defaults: StoredSettings = { ...defaultReaderSpeechSettings(service), encryptedKey: "" };
    return { value: null, settings: defaults };
  }
  try {
    const settings = storedSchema.parse(JSON.parse(row.value));
    if (settings.service === service) return { value: row.value, settings };
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

function resolveBaseURL(requested: string | undefined, saved: string) {
  if (requested !== undefined) return requested;
  if (saved !== MIMO_API_BASE_URL) throw staleSettings();
  return saved;
}

function requireNewKey() {
  return new ApiError("更改 Base URL 后请填写对应的 API Key。", 42211, 422);
}

function validateKey(baseURL: string, apiKey: string) {
  if (isEncryptedSecret(apiKey)) throw new ApiError("请填写服务商提供的原始 API Key。", 42200, 422);
  const message = readerSpeechApiKeyError(baseURL, apiKey);
  if (message) throw new ApiError(message, 42200, 422);
}

export async function saveReaderSpeechSettings(input: SettingsInput): Promise<AdminReaderSpeechSettings> {
  const { apiKey, clearApiKey, baseURL: requested, ...settings } = input;
  const previous = await loadSettings(settings.service);
  const key = keys[settings.service];
  const baseURL = resolveBaseURL(requested, previous.settings.baseURL);
  validateKey(baseURL, apiKey);
  if (baseURL !== previous.settings.baseURL && previous.settings.encryptedKey && !apiKey && !clearApiKey) {
    throw requireNewKey();
  }
  const next: StoredSettings = {
    ...settings,
    baseURL,
    encryptedKey: clearApiKey ? "" : apiKey ? encryptSecret(apiKey) : previous.settings.encryptedKey,
  };
  if (next.enabled && !next.encryptedKey) throw new ApiError("启用服务前请填写 API Key", 42210, 422);
  // Keep the default profile readable by releases that predate configurable endpoints.
  const value = JSON.stringify({ ...next, baseURL: baseURL === MIMO_API_BASE_URL ? undefined : baseURL });

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
  const { apiKey, clearApiKey, baseURL: requested, ...settings } = input;
  if (apiKey && requested) return credentials({ ...settings, baseURL: requested }, apiKey);
  const { settings: stored } = await loadSettings(settings.service);
  const baseURL = resolveBaseURL(requested, stored.baseURL);
  const draft = { ...settings, baseURL };
  if (clearApiKey) return credentials(draft, "");
  if (apiKey) return credentials(draft, apiKey);
  if (baseURL !== stored.baseURL) throw requireNewKey();
  return credentials(draft, decryptSecret(stored.encryptedKey));
}
