import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_PRESETS,
  getAiProviderPreset,
} from "@/lib/ai/presets";
import {
  aiSettingsInputSchema,
  buildDatabaseAiConfig,
} from "@/lib/ai/settings-schema";

describe("AI settings presets", () => {
  it("ships safe presets for the requested domestic providers and generic compatible APIs", () => {
    expect(AI_PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
      "deepseek",
      "mimo",
      "minimax",
      "custom-openai",
      "custom-anthropic",
    ]);
    expect(getAiProviderPreset("deepseek")).toMatchObject({
      providerType: "openai-compatible",
      baseURL: "https://api.deepseek.com",
      openAiAuthMode: "bearer",
    });
    expect(getAiProviderPreset("mimo")).toMatchObject({
      providerType: "openai-compatible",
      baseURL: "https://api.xiaomimimo.com/v1",
      openAiAuthMode: "api-key",
    });
    expect(getAiProviderPreset("minimax")).toMatchObject({
      providerType: "anthropic-compatible",
      baseURL: "https://api.minimaxi.com/anthropic",
      anthropicAuthMode: "auth-token",
    });
  });
});

describe("AI settings validation", () => {
  const validInput = {
    mode: "database",
    enabled: true,
    preset: "deepseek",
    providerType: "openai-compatible",
    providerName: "deepseek",
    baseURL: "https://api.deepseek.com",
    apiKey: "fixture-key",
    clearApiKey: false,
    textModel: "deepseek-v4-flash",
    supportsStructuredOutputs: true,
    requestTimeoutMs: 120_000,
    openAiAuthMode: "bearer",
    anthropicAuthMode: "api-key",
  } as const;

  it("builds a runtime config without weakening the existing URL checks", () => {
    const parsed = aiSettingsInputSchema.parse(validInput);
    expect(buildDatabaseAiConfig(parsed, "stored-secret")).toEqual({
      providerType: "openai-compatible",
      providerName: "deepseek",
      baseURL: "https://api.deepseek.com",
      apiKey: "stored-secret",
      textModel: "deepseek-v4-flash",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "bearer",
    });
  });

  it.each([
    [{ ...validInput, baseURL: "http://api.deepseek.com" }, "HTTPS"],
    [{ ...validInput, baseURL: "https://user:pass@api.deepseek.com" }, "安全"],
    [{ ...validInput, apiKey: "密钥-不是-ASCII" }, "ASCII"],
    [{ ...validInput, requestTimeoutMs: 3_000_000 }, "超时"],
  ])("rejects unsafe model settings %#", (candidate, message) => {
    const parsed = aiSettingsInputSchema.safeParse(candidate);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.errors[0]?.message).toContain(message);
    }
  });
});
