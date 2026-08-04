import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  encryptSecret: vi.fn((value: string) => `encrypted:${value}`),
  decryptSecret: vi.fn((value: string) => value.replace(/^encrypted:/, "")),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));
vi.mock("@/lib/secret-crypto", () => ({
  encryptSecret: mocks.encryptSecret,
  decryptSecret: mocks.decryptSecret,
}));

import {
  getAdminAiSettings,
  resolveAiConfig,
  saveAdminAiSettings,
} from "@/lib/ai/settings-service";

describe("AI settings service", () => {
  const env = (values: Record<string, string>): NodeJS.ProcessEnv => ({
    ...process.env,
    ...values,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.upsert.mockResolvedValue({});
  });

  it("keeps environment configuration as the backward-compatible default", async () => {
    const config = await resolveAiConfig(env({
      AI_ENABLED: "true",
      AI_PROVIDER_NAME: "existing-env",
      AI_BASE_URL: "https://provider.example/v1",
      AI_API_KEY: "environment-secret",
      AI_TEXT_MODEL: "fixture-model",
    }));

    expect(config).toMatchObject({
      providerName: "existing-env",
      apiKey: "environment-secret",
      textModel: "fixture-model",
    });
  });

  it("falls back to a valid environment config when settings storage is unavailable", async () => {
    mocks.findMany.mockRejectedValue(new Error("database unavailable"));

    await expect(resolveAiConfig(env({
      AI_ENABLED: "true",
      AI_PROVIDER_NAME: "existing-env",
      AI_BASE_URL: "https://provider.example/v1",
      AI_API_KEY: "environment-secret",
      AI_TEXT_MODEL: "fixture-model",
    }))).resolves.toMatchObject({
      providerName: "existing-env",
      apiKey: "environment-secret",
    });
  });

  it("returns only a configured flag to the admin UI, never the stored secret", async () => {
    mocks.findMany.mockResolvedValue([
      { key: "aiConfigMode", value: "database" },
      { key: "aiEnabled", value: "true" },
      { key: "aiProviderPreset", value: "minimax" },
      { key: "aiApiKey", value: "encrypted:stored-secret" },
      { key: "aiApiKeyProviderFingerprint", value: "anthropic-compatible|https://api.minimaxi.com/anthropic|auth-token" },
    ]);

    const settings = await getAdminAiSettings(env({
      AI_ENABLED: "false",
    }));

    expect(settings).toMatchObject({
      mode: "database",
      enabled: true,
      preset: "minimax",
      apiKey: "",
      apiKeyConfigured: true,
    });
    expect(JSON.stringify(settings)).not.toContain("stored-secret");
    expect(mocks.decryptSecret).not.toHaveBeenCalled();
  });

  it("decrypts the database key only when resolving the server-side model", async () => {
    mocks.findMany.mockResolvedValue([
      { key: "aiConfigMode", value: "database" },
      { key: "aiEnabled", value: "true" },
      { key: "aiProviderPreset", value: "mimo" },
      { key: "aiProviderType", value: "openai-compatible" },
      { key: "aiProviderName", value: "mimo" },
      { key: "aiBaseURL", value: "https://api.xiaomimimo.com/v1" },
      { key: "aiApiKey", value: "encrypted:stored-secret" },
      { key: "aiApiKeyProviderFingerprint", value: "openai-compatible|https://api.xiaomimimo.com/v1|api-key" },
      { key: "aiTextModel", value: "mimo-v2.5-pro" },
      { key: "aiSupportsStructuredOutputs", value: "true" },
      { key: "aiRequestTimeoutMs", value: "120000" },
      { key: "aiOpenAiAuthMode", value: "api-key" },
    ]);

    await expect(resolveAiConfig({} as NodeJS.ProcessEnv)).resolves.toMatchObject({
      providerName: "mimo",
      apiKey: "stored-secret",
      openAiAuthMode: "api-key",
    });
    expect(mocks.decryptSecret).toHaveBeenCalledWith("encrypted:stored-secret");
  });

  it("encrypts a rotated key and never persists the plaintext", async () => {
    await saveAdminAiSettings({
      mode: "database",
      enabled: true,
      preset: "deepseek",
      providerType: "openai-compatible",
      providerName: "deepseek",
      baseURL: "https://api.deepseek.com",
      apiKey: "new-secret",
      clearApiKey: false,
      textModel: "deepseek-v4-flash",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "bearer",
      anthropicAuthMode: "api-key",
    });

    expect(mocks.encryptSecret).toHaveBeenCalledWith("new-secret");
    const calls = mocks.upsert.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(calls.some((call) => call.includes("encrypted:new-secret"))).toBe(true);
    expect(calls.every((call) => !call.includes('"value":"new-secret"'))).toBe(true);
  });

  it("requires a stored or newly entered key before enabling database mode", async () => {
    await expect(saveAdminAiSettings({
      mode: "database",
      enabled: true,
      preset: "deepseek",
      providerType: "openai-compatible",
      providerName: "deepseek",
      baseURL: "https://api.deepseek.com",
      apiKey: "",
      clearApiKey: false,
      textModel: "deepseek-v4-flash",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "bearer",
      anthropicAuthMode: "api-key",
    })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not reuse an encrypted key after the provider endpoint or auth mode changes", async () => {
    mocks.findMany.mockResolvedValue([
      { key: "aiApiKey", value: "encrypted:deepseek-secret" },
      { key: "aiApiKeyProviderFingerprint", value: "openai-compatible|https://api.deepseek.com|bearer" },
    ]);

    await expect(saveAdminAiSettings({
      mode: "database",
      enabled: true,
      preset: "minimax",
      providerType: "anthropic-compatible",
      providerName: "minimax",
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey: "",
      clearApiKey: false,
      textModel: "MiniMax-M3",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "bearer",
      anthropicAuthMode: "auth-token",
    })).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(mocks.decryptSecret).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("switches back to environment mode without overwriting the saved database profile", async () => {
    await saveAdminAiSettings({
      mode: "environment",
      enabled: true,
      preset: "deepseek",
      providerType: "openai-compatible",
      providerName: "environment-provider",
      baseURL: "https://environment.example/v1",
      apiKey: "",
      clearApiKey: false,
      textModel: "environment-model",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      openAiAuthMode: "bearer",
      anthropicAuthMode: "api-key",
    });

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "aiConfigMode" },
      update: { value: "environment", type: "string" },
      create: { key: "aiConfigMode", value: "environment", type: "string" },
    });
  });
});
