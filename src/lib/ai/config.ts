const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_PROVIDER_NAME = "cloudmantou-ai";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MIN_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 300_000;

export type AiProviderType = "openai-compatible" | "anthropic-compatible";

export type AiConfigurationErrorCode =
  | "AI_DISABLED"
  | "AI_NOT_CONFIGURED"
  | "AI_INVALID_CONFIG";

export type AiConfig = {
  providerType: AiProviderType;
  providerName: string;
  baseURL: string;
  apiKey: string;
  textModel: string;
  supportsStructuredOutputs: boolean;
  requestTimeoutMs: number;
  anthropicAuthMode?: "auth-token" | "api-key";
};

export class AiConfigurationError extends Error {
  constructor(
    public readonly code: AiConfigurationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AiConfigurationError("AI_INVALID_CONFIG", "AI 布尔配置格式错误");
}

function validateBaseUrl(rawValue: string): string {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_BASE_URL 格式错误");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const protocolIsAllowed = url.protocol === "https:"
    || (url.protocol === "http:" && loopbackHosts.has(url.hostname));
  if (!protocolIsAllowed || url.username || url.password || url.search || url.hash) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_BASE_URL 安全校验失败");
  }

  return url.toString().replace(/\/$/, "");
}

function readProviderType(value: string | undefined): AiProviderType {
  const providerType = value?.trim() || "openai-compatible";
  if (providerType === "openai-compatible" || providerType === "anthropic-compatible") {
    return providerType;
  }
  throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_PROVIDER_TYPE 格式错误");
}

function readRequestTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutMs = Number(value);
  if (
    !Number.isSafeInteger(timeoutMs)
    || timeoutMs < MIN_REQUEST_TIMEOUT_MS
    || timeoutMs > MAX_REQUEST_TIMEOUT_MS
  ) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_REQUEST_TIMEOUT_MS 超出允许范围");
  }
  return timeoutMs;
}

function readAnthropicAuthMode(
  value: string | undefined,
  fallback: "auth-token" | "api-key",
): "auth-token" | "api-key" {
  const mode = value?.trim() || fallback;
  if (mode === "auth-token" || mode === "api-key") return mode;
  throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_ANTHROPIC_AUTH_MODE 格式错误");
}

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  if (!readBoolean(env.AI_ENABLED, false)) {
    throw new AiConfigurationError("AI_DISABLED", "AI 服务未启用");
  }

  const providerType = readProviderType(env.AI_PROVIDER_TYPE);
  const anthropicAuthToken = env.ANTHROPIC_AUTH_TOKEN?.trim() || "";
  const anthropicApiKey = env.ANTHROPIC_API_KEY?.trim() || "";
  const apiKey = env.AI_API_KEY?.trim()
    || (providerType === "anthropic-compatible" ? anthropicAuthToken || anthropicApiKey : "");
  const textModel = env.AI_TEXT_MODEL?.trim()
    || (providerType === "anthropic-compatible" ? env.ANTHROPIC_MODEL?.trim() : "")
    || "";
  if (!apiKey || !textModel) {
    throw new AiConfigurationError("AI_NOT_CONFIGURED", "AI 服务配置不完整");
  }

  const providerName = env.AI_PROVIDER_NAME?.trim() || DEFAULT_PROVIDER_NAME;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(providerName)) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_PROVIDER_NAME 格式错误");
  }

  return {
    providerType,
    providerName,
    baseURL: validateBaseUrl(
      env.AI_BASE_URL?.trim()
      || (providerType === "anthropic-compatible"
        ? env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL
        : DEFAULT_AI_BASE_URL),
    ),
    apiKey,
    textModel,
    supportsStructuredOutputs: readBoolean(
      env.AI_SUPPORTS_STRUCTURED_OUTPUTS,
      true,
    ),
    requestTimeoutMs: readRequestTimeout(env.AI_REQUEST_TIMEOUT_MS),
    ...(providerType === "anthropic-compatible"
      ? {
          anthropicAuthMode: readAnthropicAuthMode(
            env.AI_ANTHROPIC_AUTH_MODE,
            anthropicAuthToken && !env.AI_API_KEY?.trim() ? "auth-token" : "api-key",
          ),
        }
      : {}),
  };
}
