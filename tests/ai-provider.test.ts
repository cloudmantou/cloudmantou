import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAiConfig: vi.fn(),
  createAnthropic: vi.fn(),
  createOpenAICompatible: vi.fn(),
  anthropicModel: vi.fn((model: string) => `anthropic:${model}`),
  openAiChatModel: vi.fn((model: string) => `openai:${model}`),
}));

vi.mock("@/lib/ai/settings-service", () => ({ resolveAiConfig: mocks.resolveAiConfig }));
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

  it("normalizes the MiniMax Anthropic URL and sends bearer authentication server-side", async () => {
    mocks.resolveAiConfig.mockResolvedValue({
      providerType: "anthropic-compatible",
      providerName: "minimax",
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey: "fixture-secret",
      textModel: "MiniMax-M3",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      anthropicAuthMode: "auth-token",
    });

    const result = await getAiTextModel();

    expect(mocks.createAnthropic).toHaveBeenCalledWith({
      baseURL: "https://api.minimaxi.com/anthropic/v1",
      authToken: "fixture-secret",
      name: "minimax",
      fetch: expect.any(Function),
    });
    expect(mocks.anthropicModel).toHaveBeenCalledWith("MiniMax-M3");
    expect(result.model).toBe("anthropic:MiniMax-M3");
    expect(mocks.createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("preserves the existing OpenAI-compatible provider path", async () => {
    mocks.resolveAiConfig.mockResolvedValue({
      providerType: "openai-compatible",
      providerName: "fixture",
      baseURL: "https://provider.example.test/v1",
      apiKey: "fixture-secret",
      textModel: "fixture-model",
      supportsStructuredOutputs: false,
      requestTimeoutMs: 30_000,
      openAiAuthMode: "bearer",
    });

    const result = await getAiTextModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "fixture",
      baseURL: "https://provider.example.test/v1",
      apiKey: "fixture-secret",
      supportsStructuredOutputs: false,
      fetch: expect.any(Function),
    });
    expect(mocks.openAiChatModel).toHaveBeenCalledWith("fixture-model");
    expect(result.model).toBe("openai:fixture-model");
    expect(mocks.createAnthropic).not.toHaveBeenCalled();
  });

  it("uses the documented api-key header for the MiMo OpenAI-compatible preset", async () => {
    mocks.resolveAiConfig.mockResolvedValue({
      providerType: "openai-compatible",
      providerName: "mimo",
      baseURL: "https://api.xiaomimimo.com/v1",
      apiKey: "fixture-mimo-secret",
      textModel: "mimo-v2.5-pro",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "api-key",
    });

    await getAiTextModel();

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "mimo",
      baseURL: "https://api.xiaomimimo.com/v1",
      headers: { "api-key": "fixture-mimo-secret" },
      supportsStructuredOutputs: true,
      fetch: expect.any(Function),
    });
  });
});
