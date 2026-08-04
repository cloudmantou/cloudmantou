import { BlockList, isIP } from "node:net";

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
  openAiAuthMode?: "bearer" | "api-key";
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

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::", 96],
  ["::1", 128],
  ["::ffff:0.0.0.0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export function normalizeAiHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

export function isAiLoopbackHostname(hostname: string): boolean {
  return new Set(["localhost", "127.0.0.1", "::1"]).has(normalizeAiHostname(hostname));
}

export function isPublicAiAddress(hostname: string): boolean {
  const normalized = normalizeAiHostname(hostname);
  const family = isIP(normalized);
  if (family === 4) return !blockedIpv4Addresses.check(normalized, "ipv4");
  if (family === 6) return !blockedIpv6Addresses.check(normalized, "ipv6");
  return false;
}

function isBlockedAddress(hostname: string): boolean {
  const family = isIP(hostname);
  if (family === 4 || family === 6) return !isPublicAiAddress(hostname);
  return false;
}

export function validateAiBaseUrl(
  rawValue: string,
  options: { allowLoopback?: boolean } = {},
): string {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_BASE_URL 格式错误");
  }

  const hostname = normalizeAiHostname(url.hostname);
  const isLoopback = isAiLoopbackHostname(hostname);
  const protocolIsAllowed = url.protocol === "https:"
    || (url.protocol === "http:" && options.allowLoopback && isLoopback);
  const usesStandardPublicPort = !url.port || url.port === "443";
  const forbiddenHostname = !hostname
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || (isBlockedAddress(hostname) && !(options.allowLoopback && isLoopback));
  if (
    !protocolIsAllowed
    || (!isLoopback && !usesStandardPublicPort)
    || forbiddenHostname
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_BASE_URL 安全校验失败");
  }

  return url.toString().replace(/\/$/, "");
}

function validateApiKey(value: string): string {
  if (value.length > 512 || !/^[\x21-\x7E]+$/.test(value)) {
    throw new AiConfigurationError(
      "AI_INVALID_CONFIG",
      "AI_API_KEY 只支持 512 字符以内的可打印 ASCII 字符",
    );
  }
  return value;
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

function readOpenAiAuthMode(value: string | undefined): "bearer" | "api-key" {
  const mode = value?.trim() || "bearer";
  if (mode === "bearer" || mode === "api-key") return mode;
  throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_OPENAI_AUTH_MODE 格式错误");
}

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  if (!readBoolean(env.AI_ENABLED, false)) {
    throw new AiConfigurationError("AI_DISABLED", "AI 服务未启用");
  }

  const providerType = readProviderType(env.AI_PROVIDER_TYPE);
  const anthropicAuthToken = env.ANTHROPIC_AUTH_TOKEN?.trim() || "";
  const anthropicApiKey = env.ANTHROPIC_API_KEY?.trim() || "";
  const rawApiKey = env.AI_API_KEY?.trim()
    || (providerType === "anthropic-compatible" ? anthropicAuthToken || anthropicApiKey : "");
  const textModel = env.AI_TEXT_MODEL?.trim()
    || (providerType === "anthropic-compatible" ? env.ANTHROPIC_MODEL?.trim() : "")
    || "";
  if (!rawApiKey || !textModel) {
    throw new AiConfigurationError("AI_NOT_CONFIGURED", "AI 服务配置不完整");
  }
  const apiKey = validateApiKey(rawApiKey);

  const providerName = env.AI_PROVIDER_NAME?.trim() || DEFAULT_PROVIDER_NAME;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(providerName)) {
    throw new AiConfigurationError("AI_INVALID_CONFIG", "AI_PROVIDER_NAME 格式错误");
  }

  return {
    providerType,
    providerName,
    baseURL: validateAiBaseUrl(
      env.AI_BASE_URL?.trim()
      || (providerType === "anthropic-compatible"
        ? env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL
        : DEFAULT_AI_BASE_URL),
      { allowLoopback: true },
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
      : { openAiAuthMode: readOpenAiAuthMode(env.AI_OPENAI_AUTH_MODE) }),
  };
}
