import { describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { createAiTextModel } from "@/lib/ai/provider";
import type { AiConfig } from "@/lib/ai/config";

const upstream = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("@/lib/ai/safe-fetch-server", () => ({ createSafeAiFetch: () => upstream }));

describe("MiMo OpenAI-compatible provider", () => {
  it("uses the official completion budget and disables thinking for the text connection test", async () => {
    const config: AiConfig = {
      providerType: "openai-compatible",
      providerName: "mimo",
      baseURL: "https://api.xiaomimimo.com/v1",
      apiKey: "sk-fixture-key",
      textModel: "mimo-v2.6-flash",
      openAiAuthMode: "api-key",
      supportsStructuredOutputs: true,
      requestTimeoutMs: 30_000,
    };
    upstream.mockResolvedValueOnce(Response.json({
      model: config.textModel,
      choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
    }));
    const { model } = createAiTextModel(config, { connectionTest: true });
    const result = await generateText({ model, prompt: "Reply with exactly: OK", maxOutputTokens: 64 });

    const request = new Request(...upstream.mock.calls[0]);
    expect(request.url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(request.headers.get("api-key")).toBe(config.apiKey);
    const body = await request.json();
    expect(body).toMatchObject({ model: config.textModel, max_completion_tokens: 64, thinking: { type: "disabled" } });
    expect(body).not.toHaveProperty("max_tokens");
    expect(result.text).toBe("OK");
  });
});
