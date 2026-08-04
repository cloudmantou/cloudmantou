import { z } from "zod";
import {
  AiConfigurationError,
  type AiConfig,
  readAiConfig,
  validateAiBaseUrl,
} from "@/lib/ai/config";

const presetIds = [
  "deepseek",
  "mimo",
  "minimax",
  "custom-openai",
  "custom-anthropic",
] as const;

const apiKeySchema = z
  .string()
  .max(512, "API Key 最多 512 个字符")
  .refine((value) => value === "" || /^[\x21-\x7E]+$/.test(value), {
    message: "API Key 只支持可打印 ASCII 字符",
  });

const baseUrlSchema = z.string().max(500).superRefine((value, ctx) => {
  try {
    validateAiBaseUrl(value, { allowLoopback: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Base URL 安全校验失败";
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: value.startsWith("http://") && !value.includes("localhost") && !value.includes("127.0.0.1")
        ? "Base URL 必须使用 HTTPS"
        : message.replace("AI_BASE_URL", "Base URL"),
    });
  }
});

export const aiSettingsInputSchema = z
  .object({
    mode: z.enum(["environment", "database"]),
    enabled: z.boolean(),
    preset: z.enum(presetIds),
    providerType: z.enum(["openai-compatible", "anthropic-compatible"]),
    providerName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, "Provider 名称格式错误"),
    baseURL: baseUrlSchema,
    apiKey: apiKeySchema.default(""),
    clearApiKey: z.boolean().default(false),
    textModel: z.string().trim().min(1, "模型 ID 不能为空").max(200),
    supportsStructuredOutputs: z.boolean(),
    requestTimeoutMs: z.number().int().min(5_000, "请求超时至少为 5 秒").max(300_000, "请求超时最多为 300 秒"),
    openAiAuthMode: z.enum(["bearer", "api-key"]),
    anthropicAuthMode: z.enum(["auth-token", "api-key"]),
  })
  .strict();

export type AiSettingsInput = z.infer<typeof aiSettingsInputSchema>;

export type AdminAiSettings = AiSettingsInput & {
  apiKeyConfigured: boolean;
  status: "ready" | "disabled" | "incomplete" | "invalid";
};

export function buildDatabaseAiConfig(
  settings: AiSettingsInput,
  apiKey: string,
): AiConfig {
  const config = readAiConfig({
    NODE_ENV: process.env.NODE_ENV,
    AI_ENABLED: String(settings.enabled),
    AI_PROVIDER_TYPE: settings.providerType,
    AI_PROVIDER_NAME: settings.providerName,
    AI_BASE_URL: settings.baseURL,
    AI_API_KEY: apiKey,
    AI_TEXT_MODEL: settings.textModel,
    AI_SUPPORTS_STRUCTURED_OUTPUTS: String(settings.supportsStructuredOutputs),
    AI_REQUEST_TIMEOUT_MS: String(settings.requestTimeoutMs),
    AI_OPENAI_AUTH_MODE: settings.openAiAuthMode,
    AI_ANTHROPIC_AUTH_MODE: settings.anthropicAuthMode,
  });
  return {
    ...config,
    baseURL: validateAiBaseUrl(settings.baseURL, { allowLoopback: false }),
  };
}

export function configurationStatus(error: unknown): AdminAiSettings["status"] {
  if (!(error instanceof AiConfigurationError)) return "invalid";
  if (error.code === "AI_DISABLED") return "disabled";
  if (error.code === "AI_NOT_CONFIGURED") return "incomplete";
  return "invalid";
}
