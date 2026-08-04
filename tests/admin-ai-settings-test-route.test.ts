import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  resolveAiTestConfig: vi.fn(),
  createAiTextModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: number, public status: number) {
      super(message);
    }
  },
  requireAdminAndAudit: mocks.requireAdminAndAudit,
}));
vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/ai/provider", () => ({ createAiTextModel: mocks.createAiTextModel }));
vi.mock("@/lib/ai/settings-service", () => ({ resolveAiTestConfig: mocks.resolveAiTestConfig }));
vi.mock("ai", () => ({ generateText: mocks.generateText }));

import { POST } from "@/app/api/admin/settings/ai/test/route";

const validSettings = {
  mode: "database",
  enabled: true,
  preset: "deepseek",
  providerType: "openai-compatible",
  providerName: "deepseek",
  baseURL: "https://api.deepseek.com",
  apiKey: "fixture-secret",
  clearApiKey: false,
  textModel: "deepseek-v4-flash",
  supportsStructuredOutputs: true,
  requestTimeoutMs: 120_000,
  openAiAuthMode: "bearer",
  anthropicAuthMode: "api-key",
} as const;

describe("admin AI connection test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.checkRateLimit.mockResolvedValue(null);
    const config = {
      ...validSettings,
      apiKey: "fixture-secret",
    };
    mocks.resolveAiTestConfig.mockResolvedValue(config);
    mocks.createAiTextModel.mockReturnValue({
      model: "model-fixture",
      config: {
        providerName: "deepseek",
        textModel: "deepseek-v4-flash",
        requestTimeoutMs: 120_000,
      },
    });
    mocks.generateText.mockResolvedValue({ text: "OK" });
  });

  it("runs a bounded minimal model request and returns non-secret diagnostics", async () => {
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings/ai/test", {
      method: "POST",
      body: JSON.stringify(validSettings),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Reply with exactly: OK",
      maxOutputTokens: 8,
      maxRetries: 0,
      timeout: 30_000,
    }));
    expect(mocks.resolveAiTestConfig).toHaveBeenCalledWith(validSettings);
    expect(body.data).toMatchObject({
      connected: true,
      provider: "deepseek",
      model: "deepseek-v4-flash",
    });
  });

  it("honors the per-admin rate limiter before contacting a model", async () => {
    const limited = new Response(JSON.stringify({ message: "too many" }), { status: 429 });
    mocks.checkRateLimit.mockResolvedValue(limited);
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings/ai/test", { method: "POST" });

    const response = await POST(request);

    expect(response).toBe(limited);
    expect(mocks.resolveAiTestConfig).not.toHaveBeenCalled();
  });
});
