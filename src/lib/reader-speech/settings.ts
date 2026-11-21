import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secret-crypto";
import {
  defaultReaderSpeechSettings, MIMO_ROLE_MODELS, MIMO_TTS_MODEL, MIMO_TTS_VOICES,
  READER_SPEECH_SERVICES,
  type AdminReaderSpeechSettings, type ReaderSpeechCredentials,
  type ReaderSpeechService, type ReaderSpeechSettings,
} from "@/lib/reader-speech/config";

const keys = {
  roles: "readerSpeechRoles",
  tts: "readerSpeechTts",
} as const;

const sharedFields = { enabled: z.boolean(), dailyLimit: z.number().int().min(1).max(100_000) };
const roles = z.object({ ...sharedFields, service: z.literal("roles"), model: z.enum(MIMO_ROLE_MODELS) }).strict();
const tts = z.object({
  ...sharedFields, service: z.literal("tts"), model: z.literal(MIMO_TTS_MODEL), voice: z.enum(MIMO_TTS_VOICES),
}).strict();
const keyFields = {
  apiKey: z.string().trim().max(512).refine((key) => !key || /^sk-\S+$/.test(key), {
    message: "请填写 MiMo 开放平台的按量付费 API Key",
  }),
  clearApiKey: z.boolean(),
};

export const readerSpeechSettingsInput = z.discriminatedUnion("service", [
  roles.extend(keyFields), tts.extend(keyFields),
]).refine(({ apiKey, clearApiKey }) => !apiKey || !clearApiKey, {
  message: "保存新 Key 时请取消清除 Key",
});

const encryptedKey = z.string().refine((value) => !value || isEncryptedSecret(value));
const storedSchema = z.discriminatedUnion("service", [roles.extend({ encryptedKey }), tts.extend({ encryptedKey })]);
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

export async function saveReaderSpeechSettings(input: SettingsInput): Promise<AdminReaderSpeechSettings> {
  const { apiKey, clearApiKey, ...settings } = input;
  const previous = await loadSettings(settings.service);
  const key = keys[settings.service];
  const next: StoredSettings = {
    ...settings,
    encryptedKey: clearApiKey ? "" : apiKey ? encryptSecret(apiKey) : previous.settings.encryptedKey,
  };
  if (next.enabled && !next.encryptedKey) throw new ApiError("启用服务前请填写 API Key", 42210, 422);
  const value = JSON.stringify(next);

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
  return { ...settings, apiKey: key };
}

export async function resolveReaderSpeechService(service: ReaderSpeechService): Promise<ReaderSpeechCredentials> {
  const { settings: stored } = await loadSettings(service);
  const { encryptedKey, ...settings } = stored;
  if (!settings.enabled) throw new ApiError("该听书服务尚未启用", 50310, 503);
  return credentials(settings, decryptSecret(encryptedKey));
}

export async function resolveReaderSpeechTest(input: SettingsInput): Promise<ReaderSpeechCredentials> {
  const { apiKey, clearApiKey, ...settings } = input;
  if (clearApiKey) return credentials(settings, "");
  if (apiKey) return credentials(settings, apiKey);
  const { settings: stored } = await loadSettings(settings.service);
  return credentials(settings, decryptSecret(stored.encryptedKey));
}
