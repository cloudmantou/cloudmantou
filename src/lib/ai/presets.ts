import type { AiProviderType } from "@/lib/ai/config";

export type AiProviderPresetId =
  | "deepseek"
  | "mimo"
  | "minimax"
  | "custom-openai"
  | "custom-anthropic";

export type AiProviderPreset = {
  id: AiProviderPresetId;
  label: string;
  description: string;
  providerType: AiProviderType;
  providerName: string;
  baseURL: string;
  textModel: string;
  supportsStructuredOutputs: boolean;
  openAiAuthMode: "bearer" | "api-key";
  anthropicAuthMode: "auth-token" | "api-key";
};

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek 国内 API，OpenAI 兼容协议",
    providerType: "openai-compatible",
    providerName: "deepseek",
    baseURL: "https://api.deepseek.com",
    textModel: "deepseek-v4-flash",
    supportsStructuredOutputs: true,
    openAiAuthMode: "bearer",
    anthropicAuthMode: "api-key",
  },
  {
    id: "mimo",
    label: "小米 MiMo",
    description: "小米 MiMo 国内 API，使用 api-key 请求头",
    providerType: "openai-compatible",
    providerName: "mimo",
    baseURL: "https://api.xiaomimimo.com/v1",
    textModel: "mimo-v2.5-pro",
    supportsStructuredOutputs: true,
    openAiAuthMode: "api-key",
    anthropicAuthMode: "api-key",
  },
  {
    id: "minimax",
    label: "MiniMax",
    description: "MiniMax 国内 API，优先使用 Anthropic 兼容协议",
    providerType: "anthropic-compatible",
    providerName: "minimax",
    baseURL: "https://api.minimaxi.com/anthropic",
    textModel: "MiniMax-M3",
    supportsStructuredOutputs: true,
    openAiAuthMode: "bearer",
    anthropicAuthMode: "auth-token",
  },
  {
    id: "custom-openai",
    label: "自定义 OpenAI 兼容",
    description: "接入任意兼容 Chat Completions 的模型服务",
    providerType: "openai-compatible",
    providerName: "custom-openai",
    baseURL: "https://api.example.com/v1",
    textModel: "model-id",
    supportsStructuredOutputs: true,
    openAiAuthMode: "bearer",
    anthropicAuthMode: "api-key",
  },
  {
    id: "custom-anthropic",
    label: "自定义 Anthropic 兼容",
    description: "接入任意兼容 Messages API 的模型服务",
    providerType: "anthropic-compatible",
    providerName: "custom-anthropic",
    baseURL: "https://api.example.com/anthropic",
    textModel: "model-id",
    supportsStructuredOutputs: true,
    openAiAuthMode: "bearer",
    anthropicAuthMode: "api-key",
  },
] as const;

export function getAiProviderPreset(id: AiProviderPresetId): AiProviderPreset {
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === id) ?? AI_PROVIDER_PRESETS[0];
}

export function isAiProviderPresetId(value: string): value is AiProviderPresetId {
  return AI_PROVIDER_PRESETS.some((preset) => preset.id === value);
}
