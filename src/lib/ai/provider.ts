import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { readAiConfig } from "@/lib/ai/config";

function normalizeAnthropicBaseUrl(baseURL: string): string {
  return baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`;
}

export function getAiTextModel() {
  const config = readAiConfig();
  if (config.providerType === "anthropic-compatible") {
    const provider = createAnthropic({
      baseURL: normalizeAnthropicBaseUrl(config.baseURL),
      name: config.providerName,
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
    apiKey: config.apiKey,
    supportsStructuredOutputs: config.supportsStructuredOutputs,
  });

  return {
    model: provider.chatModel(config.textModel),
    config,
  };
}
