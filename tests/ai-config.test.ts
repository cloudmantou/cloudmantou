import { describe, expect, it } from "vitest";
import {
  AiConfigurationError,
  readAiConfig,
} from "@/lib/ai/config";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("AI provider configuration", () => {
  it("reads an enabled OpenAI-compatible provider without exposing ambiguity", () => {
    expect(
      readAiConfig(
        env({
          AI_ENABLED: "true",
          AI_PROVIDER_NAME: "cc-switch",
          AI_BASE_URL: "http://127.0.0.1:15721/v1",
          AI_API_KEY: "fixture-secret",
          AI_TEXT_MODEL: "fixture-model",
          AI_SUPPORTS_STRUCTURED_OUTPUTS: "true",
          NODE_ENV: "production",
        }),
      ),
    ).toEqual({
      providerType: "openai-compatible",
      providerName: "cc-switch",
      baseURL: "http://127.0.0.1:15721/v1",
      apiKey: "fixture-secret",
      textModel: "fixture-model",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 30_000,
      openAiAuthMode: "bearer",
    });
  });

  it("maps MiniMax Anthropic-compatible server variables without exposing the token", () => {
    expect(
      readAiConfig(
        env({
          AI_ENABLED: "true",
          AI_PROVIDER_TYPE: "anthropic-compatible",
          AI_PROVIDER_NAME: "minimax",
          ANTHROPIC_BASE_URL: "https://api.minimaxi.com/anthropic",
          ANTHROPIC_AUTH_TOKEN: "fixture-minimax-token",
          ANTHROPIC_MODEL: "MiniMax-M3",
          AI_REQUEST_TIMEOUT_MS: "120000",
        }),
      ),
    ).toEqual({
      providerType: "anthropic-compatible",
      providerName: "minimax",
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey: "fixture-minimax-token",
      textModel: "MiniMax-M3",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 120_000,
      anthropicAuthMode: "auth-token",
    });
  });

  it("prefers project-scoped AI variables over inherited Claude Code variables", () => {
    expect(
      readAiConfig(
        env({
          AI_ENABLED: "true",
          AI_PROVIDER_TYPE: "anthropic-compatible",
          AI_PROVIDER_NAME: "minimax",
          AI_BASE_URL: "https://api.minimaxi.com/anthropic",
          AI_API_KEY: "project-token",
          AI_TEXT_MODEL: "MiniMax-M3",
          AI_ANTHROPIC_AUTH_MODE: "auth-token",
          ANTHROPIC_BASE_URL: "https://inherited.example.test",
          ANTHROPIC_AUTH_TOKEN: "inherited-token",
          ANTHROPIC_MODEL: "inherited-model",
        }),
      ),
    ).toMatchObject({
      providerType: "anthropic-compatible",
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey: "project-token",
      textModel: "MiniMax-M3",
      anthropicAuthMode: "auth-token",
    });
  });

  it.each([
    [{ AI_ENABLED: "false" }, "AI_DISABLED"],
    [{ AI_ENABLED: "true", AI_API_KEY: "key", AI_TEXT_MODEL: "" }, "AI_NOT_CONFIGURED"],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_BASE_URL: "http://provider.example.test/v1",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_BASE_URL: "https://169.254.169.254/v1",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_BASE_URL: "https://provider.example.test:8443/v1",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "ｓｋ-full-width",
        AI_TEXT_MODEL: "model",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_OPENAI_AUTH_MODE: "unsupported",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_BASE_URL: "https://user:pass@provider.example.test/v1",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_PROVIDER_TYPE: "unsupported",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_REQUEST_TIMEOUT_MS: "3000000",
      },
      "AI_INVALID_CONFIG",
    ],
    [
      {
        AI_ENABLED: "true",
        AI_API_KEY: "key",
        AI_TEXT_MODEL: "model",
        AI_PROVIDER_TYPE: "anthropic-compatible",
        AI_ANTHROPIC_AUTH_MODE: "unsupported",
      },
      "AI_INVALID_CONFIG",
    ],
  ] as const)("rejects disabled, incomplete, or unsafe configuration %#", (values, code) => {
    expect(() => readAiConfig(env(values))).toThrowError(
      expect.objectContaining<Partial<AiConfigurationError>>({ code }),
    );
  });
});
