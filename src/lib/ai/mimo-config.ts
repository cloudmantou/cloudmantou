const MIMO_API_HOST = "api.xiaomimimo.com";
export const MIMO_API_BASE_URL = `https://${MIMO_API_HOST}/v1`;
const MIMO_ANTHROPIC_BASE_URL = `https://${MIMO_API_HOST}/anthropic`;

export const MIMO_TOKEN_PLAN_ERROR = "MiMo Token Plan 仅适用于编程工具。请使用小米开放平台创建的按量付费 API Key。";

function parseBaseURL(baseURL: string): URL | undefined {
  try {
    return new URL(baseURL);
  } catch {
    return undefined;
  }
}

export function isMimoApiURL(baseURL: string): boolean {
  return parseBaseURL(baseURL)?.hostname.replace(/\.$/, "") === MIMO_API_HOST;
}

export function mimoApiKeyError(apiKey: string): string | undefined {
  const key = apiKey.trim();
  if (!key) return undefined;
  if (/^(?:tp|ttp)-/.test(key)) return MIMO_TOKEN_PLAN_ERROR;
  if (!/^sk-[\x21-\x7e]+$/.test(key)) {
    return "请填写小米 MiMo 开放平台创建的 sk- 按量付费 API Key。";
  }
}

export function mimoSettingsError(
  { baseURL, providerType, apiKey = "" }: { baseURL: string; providerType: string; apiKey?: string },
): string | undefined {
  const url = parseBaseURL(baseURL);
  if (!url) return undefined;
  const hostname = url.hostname.replace(/\.$/, "");
  if (/^token-plan(?:-[a-z0-9-]+)?\.xiaomimimo\.com$/.test(hostname)) return MIMO_TOKEN_PLAN_ERROR;
  if (hostname !== MIMO_API_HOST) return undefined;

  const pathname = url.pathname.replace(/\/$/, "");
  if (providerType === "anthropic-compatible") {
    if (pathname !== "/anthropic" && pathname !== "/anthropic/v1") {
      return `MiMo 的 Anthropic 兼容地址为 ${MIMO_ANTHROPIC_BASE_URL}。`;
    }
  } else if (pathname !== "/v1") {
    return `MiMo 的 OpenAI 兼容地址为 ${MIMO_API_BASE_URL}。`;
  }
  return mimoApiKeyError(apiKey);
}
