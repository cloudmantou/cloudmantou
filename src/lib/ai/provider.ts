import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { readAiConfig } from "@/lib/ai/config";

export function getAiTextModel() {
  const config = readAiConfig();
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
