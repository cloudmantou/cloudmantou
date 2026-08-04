const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_PROVIDER_NAME = "cloudmantou-ai";

export type AiConfigurationErrorCode =
  | "AI_DISABLED"
  | "AI_NOT_CONFIGURED"
  | "AI_INVALID_CONFIG";

export type AiConfig = {
  providerName: string;
  baseURL: string;
  apiKey: string;
  textModel: string;
  supportsStructuredOutputs: boolean;
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

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  if (!readBoolean(env.AI_ENABLED, false)) {
    throw new AiConfigurationError("AI_DISABLED", "AI 服务未启用");
  }

  const apiKey = env.AI_API_KEY?.trim() || "";
  const textModel = env.AI_TEXT_MODEL?.trim() || "";
  if (!apiKey || !textModel) {
    throw new AiConfigurationError("AI_NOT_CONFIGURED", "AI 服务配置不完整");
  }

  const providerName = env.AI_PROVIDER_NAME?.trim() || DEFAULT_PROVIDER_NAME;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(providerName)) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_PROVIDER_NAME 格式错误");
  }

  return {
    providerName,
    baseURL: validateBaseUrl(env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL),
    apiKey,
    textModel,
    supportsStructuredOutputs: readBoolean(
      env.AI_SUPPORTS_STRUCTURED_OUTPUTS,
      true,
    ),
  };
}
