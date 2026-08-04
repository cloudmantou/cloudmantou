import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  generateEditorialSuggestion: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public code: number,
      public status: number,
    ) {
      super(message);
    }
  },
  requireAdminAndAudit: mocks.requireAdminAndAudit,
}));

vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: mocks.checkRateLimit }));

vi.mock("@/lib/ai/editor-service", () => ({
  generateEditorialSuggestion: mocks.generateEditorialSuggestion,
}));

import { POST } from "@/app/api/admin/ai/editor/route";

function request(body: unknown) {
  return new NextRequest("https://cloudmantoua.top/api/admin/ai/editor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  task: "title",
  title: "现有标题",
  excerpt: "",
  content: "这是一段用于生成标题建议的有效文章正文，长度满足接口要求。",
  locale: "auto",
};

describe("POST /api/admin/ai/editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.generateEditorialSuggestion.mockResolvedValue({
      task: "title",
      provider: "fixture",
      model: "fixture-model",
      result: { language: "zh-CN", titles: [] },
      usage: {},
    });
  });

  it("requires an audited admin and a user-scoped AI rate limit", async () => {
    await POST(request(validBody));

    expect(mocks.requireAdminAndAudit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "ai.editor.generate",
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ scope: "admin-ai-editor", limit: 20 }),
      "admin-1",
    );
  });

  it("passes only validated public article context and request cancellation", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(mocks.generateEditorialSuggestion).toHaveBeenCalledWith(
      { ...validBody, focusKeyword: "" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    [{ ...validBody, task: "publish" }, 422],
    [{ ...validBody, content: "短" }, 422],
    [{ ...validBody, paidContent: "付费正文" }, 422],
    [{ ...validBody, locale: "fr-FR" }, 422],
  ])("rejects unsupported or extra input %#", async (body, status) => {
    const response = await POST(request(body));

    expect(response.status).toBe(status);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before generation", async () => {
    const response = await POST(request({ ...validBody, content: "a".repeat(140_000) }));

    expect(response.status).toBe(413);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
  });
});
