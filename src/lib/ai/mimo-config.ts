const MIMO_API_HOST = "api.xiaomimimo.com";
export const MIMO_API_BASE_URL = `https://${MIMO_API_HOST}/v1`;
const MIMO_ANTHROPIC_BASE_URL = `https://${MIMO_API_HOST}/anthropic`;

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
  if (!/^[\x21-\x7e]+$/.test(key)) {
    return "API Key 只能包含可打印 ASCII 字符。";
  }
}

export function mimoSettingsError(
  { baseURL, providerType, apiKey = "" }: { baseURL: string; providerType: string; apiKey?: string },
): string | undefined {
  const url = parseBaseURL(baseURL);
  if (!url) return undefined;
  const hostname = url.hostname.replace(/\.$/, "");
  if (hostname !== MIMO_API_HOST) return mimoApiKeyError(apiKey);

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
