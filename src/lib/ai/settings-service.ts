import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import {
  AiConfigurationError,
  readAiConfig,
  type AiConfig,
} from "@/lib/ai/config";
import {
  AI_PROVIDER_PRESETS,
  getAiProviderPreset,
  isAiProviderPresetId,
  type AiProviderPresetId,
} from "@/lib/ai/presets";
import {
  aiSettingsInputSchema,
  buildDatabaseAiConfig,
  configurationStatus,
  type AdminAiSettings,
  type AiSettingsInput,
} from "@/lib/ai/settings-schema";

const AI_SETTING_KEYS = [
  "aiConfigMode",
  "aiEnabled",
  "aiProviderPreset",
  "aiProviderType",
  "aiProviderName",
  "aiBaseURL",
  "aiApiKey",
  "aiApiKeyProviderFingerprint",
  "aiTextModel",
  "aiSupportsStructuredOutputs",
  "aiRequestTimeoutMs",
  "aiOpenAiAuthMode",
  "aiAnthropicAuthMode",
] as const;

type SettingRow = { key: string; value: string };

function toMap(rows: SettingRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function loadAiSettingMap(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...AI_SETTING_KEYS] } },
  });
  return toMap(rows);
}

function detectPreset(config: AiConfig): AiProviderPresetId {
  const matched = AI_PROVIDER_PRESETS.find(
    (preset) => preset.providerType === config.providerType && preset.baseURL === config.baseURL,
  );
  return matched?.id ?? (config.providerType === "anthropic-compatible" ? "custom-anthropic" : "custom-openai");
}

function defaultsFromPreset(presetId: AiProviderPresetId): AiSettingsInput {
  const preset = getAiProviderPreset(presetId);
  return {
    mode: "database",
    enabled: true,
    preset: preset.id,
    providerType: preset.providerType,
    providerName: preset.providerName,
    baseURL: preset.baseURL,
    apiKey: "",
    clearApiKey: false,
    textModel: preset.textModel,
    supportsStructuredOutputs: preset.supportsStructuredOutputs,
    requestTimeoutMs: 120_000,
    openAiAuthMode: preset.openAiAuthMode,
    anthropicAuthMode: preset.anthropicAuthMode,
  };
}

function databaseSettingsFromMap(map: Record<string, string>): AiSettingsInput {
  const presetId = isAiProviderPresetId(map.aiProviderPreset)
    ? map.aiProviderPreset
    : "minimax";
  const fallback = defaultsFromPreset(presetId);
  const parsed = aiSettingsInputSchema.safeParse({
    ...fallback,
    mode: "database",
    enabled: map.aiEnabled !== "false",
    preset: presetId,
    providerType: map.aiProviderType || fallback.providerType,
    providerName: map.aiProviderName || fallback.providerName,
    baseURL: map.aiBaseURL || fallback.baseURL,
    textModel: map.aiTextModel || fallback.textModel,
    supportsStructuredOutputs: map.aiSupportsStructuredOutputs !== "false",
    requestTimeoutMs: Number(map.aiRequestTimeoutMs || fallback.requestTimeoutMs),
    openAiAuthMode: map.aiOpenAiAuthMode || fallback.openAiAuthMode,
    anthropicAuthMode: map.aiAnthropicAuthMode || fallback.anthropicAuthMode,
  });
  if (!parsed.success) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "后台 AI 配置格式错误");
  }
  return parsed.data;
}

function providerFingerprint(settings: AiSettingsInput): string {
  const authMode = settings.providerType === "anthropic-compatible"
    ? settings.anthropicAuthMode
    : settings.openAiAuthMode;
  return `${settings.providerType}|${settings.baseURL}|${authMode}`;
}

function environmentAdminSettings(env: NodeJS.ProcessEnv): AdminAiSettings {
  try {
    const config = readAiConfig(env);
    return {
      mode: "environment",
      enabled: true,
      preset: detectPreset(config),
      providerType: config.providerType,
      providerName: config.providerName,
      baseURL: config.baseURL,
      apiKey: "",
      clearApiKey: false,
      textModel: config.textModel,
      supportsStructuredOutputs: config.supportsStructuredOutputs,
      requestTimeoutMs: config.requestTimeoutMs,
      openAiAuthMode: config.openAiAuthMode ?? "bearer",
      anthropicAuthMode: config.anthropicAuthMode ?? "api-key",
      apiKeyConfigured: true,
      status: "ready",
    };
  } catch (error) {
    return {
      ...defaultsFromPreset("minimax"),
      mode: "environment",
      enabled: false,
      apiKeyConfigured: false,
      status: configurationStatus(error),
    };
  }
}

export async function getAdminAiSettings(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdminAiSettings> {
  const map = await loadAiSettingMap();
  if (map.aiConfigMode !== "database") return environmentAdminSettings(env);

  try {
    const settings = databaseSettingsFromMap(map);
    const keyMatchesProvider = map.aiApiKeyProviderFingerprint === providerFingerprint(settings);
    let status: AdminAiSettings["status"] = settings.enabled ? "incomplete" : "disabled";
    if (settings.enabled && map.aiApiKey && keyMatchesProvider) status = "ready";
    return {
      ...settings,
      apiKey: "",
      clearApiKey: false,
      apiKeyConfigured: Boolean(map.aiApiKey && keyMatchesProvider),
      status,
    };
  } catch {
    return {
      ...defaultsFromPreset("minimax"),
      mode: "database",
      enabled: false,
      apiKeyConfigured: false,
      status: "invalid",
    };
  }
}

export async function resolveAiConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AiConfig> {
  let map: Record<string, string>;
  try {
    map = await loadAiSettingMap();
  } catch (error) {
    console.warn("[ai-config] settings storage unavailable; using environment configuration", error instanceof Error ? error.name : "UnknownError");
    return readAiConfig(env);
  }
  if (map.aiConfigMode !== "database") return readAiConfig(env);

  const settings = databaseSettingsFromMap(map);
  const keyMatchesProvider = map.aiApiKeyProviderFingerprint === providerFingerprint(settings);
  const apiKey = map.aiApiKey && keyMatchesProvider ? decryptSecret(map.aiApiKey) : "";
  return buildDatabaseAiConfig(settings, apiKey);
}

export async function resolveAiTestConfig(
  input: AiSettingsInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AiConfig> {
  const parsed = aiSettingsInputSchema.parse(input);
  if (parsed.mode === "environment") return readAiConfig(env);

  const current = await loadAiSettingMap();
  const fingerprint = providerFingerprint(parsed);
  const canReuseStoredKey = Boolean(
    current.aiApiKey
    && current.aiApiKeyProviderFingerprint === fingerprint,
  );
  const apiKey = parsed.apiKey.trim()
    || (canReuseStoredKey ? decryptSecret(current.aiApiKey) : "");
  return buildDatabaseAiConfig(parsed, apiKey);
}

async function upsertSetting(key: string, value: string, type = "string") {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value, type },
    create: { key, value, type },
  });
}

export async function saveAdminAiSettings(input: AiSettingsInput): Promise<void> {
  const parsed = aiSettingsInputSchema.parse(input);
  if (parsed.mode === "environment") {
    await upsertSetting("aiConfigMode", "environment");
    return;
  }

  const current = await loadAiSettingMap();
  const enteredKey = parsed.apiKey.trim();
  const fingerprint = providerFingerprint(parsed);
  const canReuseStoredKey = Boolean(
    current.aiApiKey
    && current.aiApiKeyProviderFingerprint === fingerprint,
  );
  const persistedEncryptedKey = parsed.clearApiKey
    ? ""
    : enteredKey
      ? encryptSecret(enteredKey)
      : canReuseStoredKey
        ? current.aiApiKey
        : "";

  if (parsed.enabled) {
    const plaintextKey = enteredKey || (persistedEncryptedKey ? decryptSecret(persistedEncryptedKey) : "");
    buildDatabaseAiConfig(parsed, plaintextKey);
  }

  const entries: Array<[string, string, string?]> = [
    ["aiConfigMode", "database"],
    ["aiEnabled", String(parsed.enabled), "boolean"],
    ["aiProviderPreset", parsed.preset],
    ["aiProviderType", parsed.providerType],
    ["aiProviderName", parsed.providerName],
    ["aiBaseURL", parsed.baseURL],
    ["aiTextModel", parsed.textModel],
    ["aiSupportsStructuredOutputs", String(parsed.supportsStructuredOutputs), "boolean"],
    ["aiRequestTimeoutMs", String(parsed.requestTimeoutMs), "number"],
    ["aiOpenAiAuthMode", parsed.openAiAuthMode],
    ["aiAnthropicAuthMode", parsed.anthropicAuthMode],
  ];
  if (enteredKey || parsed.clearApiKey) {
    entries.push(["aiApiKey", persistedEncryptedKey, "secret"]);
    entries.push([
      "aiApiKeyProviderFingerprint",
      persistedEncryptedKey ? fingerprint : "",
      "string",
    ]);
  }
  for (const [key, value, type] of entries) {
    await upsertSetting(key, value, type);
  }
}
