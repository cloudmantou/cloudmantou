import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAiConfig: vi.fn(),
  createAnthropic: vi.fn(),
  createOpenAICompatible: vi.fn(),
  anthropicModel: vi.fn((model: string) => `anthropic:${model}`),
  openAiChatModel: vi.fn((model: string) => `openai:${model}`),
}));

vi.mock("@/lib/ai/config", () => ({ readAiConfig: mocks.readAiConfig }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: mocks.createAnthropic }));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));

import { getAiTextModel } from "@/lib/ai/provider";

describe("AI text model provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAnthropic.mockReturnValue(mocks.anthropicModel);
    mocks.createOpenAICompatible.mockReturnValue({ chatModel: mocks.openAiChatModel });
  });

  it("normalizes the MiniMax Anthropic URL and sends bearer authentication server-side", () => {
    mocks.readAiConfig.mockReturnValue({
      providerType: "anthropic-compatible",
      providerName: "minimax",
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey: "fixture-secret",
      textModel: "MiniMax-M3",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      anthropicAuthMode: "auth-token",
    });

    const result = getAiTextModel();

    expect(mocks.createAnthropic).toHaveBeenCalledWith({
      baseURL: "https://api.minimaxi.com/anthropic/v1",
      authToken: "fixture-secret",
      name: "minimax",
    });
    expect(mocks.anthropicModel).toHaveBeenCalledWith("MiniMax-M3");
    expect(result.model).toBe("anthropic:MiniMax-M3");
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("preserves the existing OpenAI-compatible provider path", () => {
    mocks.readAiConfig.mockReturnValue({
      providerType: "openai-compatible",
      providerName: "fixture",
      baseURL: "https://provider.example.test/v1",
      apiKey: "fixture-secret",
      textModel: "fixture-model",
      supportsStructuredOutputs: false,
      requestTimeoutMs: 30_000,
    });

    const result = getAiTextModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "fixture",
      baseURL: "https://provider.example.test/v1",
      apiKey: "fixture-secret",
      supportsStructuredOutputs: false,
    });
    expect(mocks.openAiChatModel).toHaveBeenCalledWith("fixture-model");
    expect(result.model).toBe("openai:fixture-model");
    expect(mocks.createAnthropic).not.toHaveBeenCalled();
  });
});
