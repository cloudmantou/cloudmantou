import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiConfig } from "@/lib/ai/config";
import { createSafeAiFetch } from "@/lib/ai/safe-fetch-server";
import { resolveAiConfig } from "@/lib/ai/settings-service";

function normalizeAnthropicBaseUrl(baseURL: string): string {
  return baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`;
}

export function createAiTextModel(config: AiConfig) {
  const secureFetch = createSafeAiFetch(config.baseURL, config.requestTimeoutMs);
  if (config.providerType === "anthropic-compatible") {
    const provider = createAnthropic({
      baseURL: normalizeAnthropicBaseUrl(config.baseURL),
      name: config.providerName,
      fetch: secureFetch,
      ...(config.anthropicAuthMode === "auth-token"
        ? { authToken: config.apiKey }
        : { apiKey: config.apiKey }),
    });
    return {
      model: provider(config.textModel),
      config,
    };
  }

  const provider = createOpenAICompatible({
    name: config.providerName,
    baseURL: config.baseURL,
    fetch: secureFetch,
    ...(config.openAiAuthMode === "api-key"
      ? { headers: { "api-key": config.apiKey } }
      : { apiKey: config.apiKey }),
    supportsStructuredOutputs: config.supportsStructuredOutputs,
  });

  return {
    model: provider.chatModel(config.textModel),
    config,
  };
}

export async function getAiTextModel() {
  return createAiTextModel(await resolveAiConfig());
}
