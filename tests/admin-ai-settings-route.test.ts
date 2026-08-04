import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: number, public status: number) {
      super(message);
    }
  },
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/ai/settings-service", () => ({
  getAdminAiSettings: mocks.getSettings,
  saveAdminAiSettings: mocks.saveSettings,
}));
vi.mock("@/lib/admin-audit-log", () => ({ auditAdminAction: mocks.audit }));

import { GET, PUT } from "@/app/api/admin/settings/ai/route";

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

describe("admin AI settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.audit.mockResolvedValue(undefined);
    mocks.saveSettings.mockResolvedValue(undefined);
    mocks.getSettings.mockResolvedValue({
      ...validSettings,
      apiKey: "",
      apiKeyConfigured: true,
      status: "ready",
    });
  });

  it("returns only the masked configuration state", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.apiKey).toBe("");
    expect(body.data.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("fixture-secret");
  });

  it("validates, saves and audits a key rotation without echoing the secret", async () => {
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings/ai", {
      method: "PUT",
      body: JSON.stringify(validSettings),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.saveSettings).toHaveBeenCalledWith(validSettings);
    expect(mocks.audit).toHaveBeenCalledWith(
      request,
      "admin-1",
      "settings.ai.update",
      expect.objectContaining({ detail: expect.stringContaining("apiKey=rotated") }),
    );
    expect(JSON.stringify(body)).not.toContain("fixture-secret");
  });

  it("rejects unknown fields before persistence", async () => {
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings/ai", {
      method: "PUT",
      body: JSON.stringify({ ...validSettings, rawSecretCopy: "fixture-secret" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request);

    expect(response.status).toBe(422);
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });
});
