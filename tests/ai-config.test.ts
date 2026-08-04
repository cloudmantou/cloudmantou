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
      providerName: "cc-switch",
      baseURL: "http://127.0.0.1:15721/v1",
      apiKey: "fixture-secret",
      textModel: "fixture-model",
      supportsStructuredOutputs: true,
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
        AI_BASE_URL: "https://user:pass@provider.example.test/v1",
      },
      "AI_INVALID_CONFIG",
    ],
  ] as const)("rejects disabled, incomplete, or unsafe configuration %#", (values, code) => {
    expect(() => readAiConfig(env(values))).toThrowError(
      expect.objectContaining<Partial<AiConfigurationError>>({ code }),
    );
  });
});
