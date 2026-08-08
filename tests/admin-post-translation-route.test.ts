import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AiConfigurationError } from "@/lib/ai/config";
import { AiGenerationError } from "@/lib/ai/editor-service";
import { computePostTranslationSourceHash } from "@/lib/post-translation-source";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  requireAdminAndStrictAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  generateEditorialSuggestion: vi.fn(),
  postFindUnique: vi.fn(),
  postFindFirst: vi.fn(),
  translationFindUnique: vi.fn(),
  translationUpsert: vi.fn(),
  translationUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: number, public status: number) {
      super(message);
    }
  },
  requireAdminAndAudit: mocks.requireAdminAndAudit,
  requireAdminAndStrictAudit: mocks.requireAdminAndStrictAudit,
}));

vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/ai/editor-service", () => ({
  AiGenerationError: class AiGenerationError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  generateEditorialSuggestion: mocks.generateEditorialSuggestion,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: mocks.postFindUnique,
      findFirst: mocks.postFindFirst,
    },
    postTranslation: {
      findUnique: mocks.translationFindUnique,
      upsert: mocks.translationUpsert,
      updateMany: mocks.translationUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST, PUT } from "@/app/api/admin/posts/[id]/translations/en/route";

const sourceUpdatedAt = new Date("2026-08-08T01:02:03.000Z");
const sourcePost = {
  id: "post-1",
  title: "iOS 应用降级",
  excerpt: "适用条件与操作步骤",
  content: "## 条件\n\n这是一篇公开文章正文，说明兼容性、步骤和风险限制。",
  seoTitle: "iOS 应用降级",
  seoDescription: "说明适用条件和步骤",
  seoKeywords: ["iOS 应用降级"],
  socialTitle: null,
  socialDescription: null,
  status: "PUBLISHED",
  updatedAt: sourceUpdatedAt,
};
const sourceHash = computePostTranslationSourceHash(sourcePost);
const translationResult = {
  language: "en-US",
  title: "Downgrade iOS Apps",
  excerpt: "Requirements and steps.",
  content: "## Requirements\n\nA complete English draft.",
  seoTitle: "How to Downgrade iOS Apps",
  seoDescription: "Requirements, steps, and limitations.",
  seoKeywords: ["downgrade iOS apps", "older App Store version", "iPhone app version"],
  socialTitle: "Downgrade iOS Apps",
  socialDescription: "A practical guide.",
};
const { language: _language, ...translationFields } = translationResult;

function request(method: "GET" | "POST" | "PUT", body?: unknown) {
  return new NextRequest("https://cloudmantou.test/api/admin/posts/post-1/translations/en", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ id: "post-1" }) };

describe("admin English post translation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.translationFindUnique.mockReset();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.requireAdminAndStrictAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.postFindUnique.mockResolvedValue(sourcePost);
    mocks.postFindFirst.mockResolvedValue(sourcePost);
    mocks.translationFindUnique.mockResolvedValue(null);
    mocks.translationUpsert.mockResolvedValue({ id: "translation-1", postId: "post-1", locale: "en-US", status: "DRAFT" });
    mocks.translationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.generateEditorialSuggestion.mockResolvedValue({
      task: "translate",
      provider: "fixture-provider",
      model: "fixture-model",
      result: translationResult,
      usage: {},
    });
    mocks.transaction.mockImplementation(async (operation) => operation({
      post: { findFirst: mocks.postFindFirst },
      postTranslation: {
        findUnique: mocks.translationFindUnique,
        upsert: mocks.translationUpsert,
        updateMany: mocks.translationUpdateMany,
      },
    }));
  });

  it("requires audited admin access and a user-scoped translation rate limit", async () => {
    await POST(request("POST", {}), context);

    expect(mocks.requireAdminAndStrictAudit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "posts.translation.generate",
      { targetType: "post", targetId: "post-1" },
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ scope: "admin-post-translation", limit: 10 }),
      "admin-1",
    );
  });

  it("loads only public source fields and never reads or sends paidContent", async () => {
    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(200);
    const query = mocks.postFindUnique.mock.calls[0]?.[0];
    expect(query).toEqual({
      where: { id: "post-1" },
      select: {
        id: true,
        title: true,
        excerpt: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        socialTitle: true,
        socialDescription: true,
        status: true,
        updatedAt: true,
      },
    });
    expect(JSON.stringify(query)).not.toContain("paidContent");
    expect(mocks.generateEditorialSuggestion).toHaveBeenCalledWith({
      task: "translate",
      title: sourcePost.title,
      excerpt: sourcePost.excerpt,
      content: sourcePost.content,
      locale: "en-US",
      focusKeyword: "",
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(JSON.stringify(mocks.generateEditorialSuggestion.mock.calls[0]?.[0])).not.toContain("付费");
  });

  it("rejects PAID_ONLY posts before calling AI", async () => {
    mocks.postFindUnique.mockResolvedValue({ ...sourcePost, status: "PAID_ONLY" });

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(409);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
    expect(mocks.translationUpsert).not.toHaveBeenCalled();
  });

  it("generates translations only after the Chinese source is published", async () => {
    mocks.postFindUnique.mockResolvedValue({ ...sourcePost, status: "DRAFT" });

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(409);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
    expect(mocks.translationUpsert).not.toHaveBeenCalled();
  });

  it("does not replace a current published English version with a draft", async () => {
    mocks.translationFindUnique.mockResolvedValue({
      id: "translation-1",
      status: "PUBLISHED",
      sourceHash,
      sourceUpdatedAt,
      updatedAt: new Date("2026-08-08T02:03:04.000Z"),
    });

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(409);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
    expect(mocks.translationUpsert).not.toHaveBeenCalled();
  });

  it("rechecks translation state after generation before writing a draft", async () => {
    mocks.translationFindUnique
      .mockResolvedValueOnce({
        id: "translation-1",
        status: "STALE",
        sourceHash: "stale-source-hash",
        sourceUpdatedAt,
        updatedAt: new Date("2026-08-08T02:03:04.000Z"),
      })
      .mockResolvedValueOnce({
        id: "translation-1",
        status: "PUBLISHED",
        sourceHash,
        sourceUpdatedAt,
        updatedAt: new Date("2026-08-08T02:04:05.000Z"),
      });

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(409);
    expect(mocks.generateEditorialSuggestion).toHaveBeenCalledOnce();
    expect(mocks.translationUpsert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: 40924 });
  });

  it("stores every generated translation as DRAFT with source and model provenance", async () => {
    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mocks.translationUpsert).toHaveBeenCalledWith({
      where: { postId_locale: { postId: "post-1", locale: "en-US" } },
      create: expect.objectContaining({
        postId: "post-1",
        locale: "en-US",
        status: "DRAFT",
        sourceHash,
        sourceUpdatedAt,
        provider: "fixture-provider",
        model: "fixture-model",
        ...translationFields,
      }),
      update: expect.objectContaining({
        status: "DRAFT",
        sourceUpdatedAt,
        provider: "fixture-provider",
        model: "fixture-model",
        publishedAt: null,
      }),
    });
  });

  it("aborts persistence when the source version changed during generation", async () => {
    mocks.postFindFirst.mockResolvedValue(null);

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(409);
    expect(mocks.translationUpsert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 40921,
      message: "原文已更新，请重新生成英文译文",
    });
  });

  it("returns 404 for an unknown source post", async () => {
    mocks.postFindUnique.mockResolvedValue(null);

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(404);
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
  });

  it("rejects extra client fields so clients cannot inject source or paid text", async () => {
    const response = await POST(request("POST", { content: "伪造原文", paidContent: "付费内容" }), context);

    expect(response.status).toBe(422);
    expect(mocks.postFindUnique).not.toHaveBeenCalled();
    expect(mocks.generateEditorialSuggestion).not.toHaveBeenCalled();
  });

  it("maps missing AI configuration to 503", async () => {
    mocks.generateEditorialSuggestion.mockRejectedValue(
      new AiConfigurationError("AI_NOT_CONFIGURED", "missing"),
    );

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(503);
  });

  it("maps invalid upstream model output to 502", async () => {
    mocks.generateEditorialSuggestion.mockRejectedValue(
      new AiGenerationError("AI_INVALID_OUTPUT", "invalid"),
    );

    const response = await POST(request("POST", {}), context);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 50210,
      message: "AI 返回内容格式错误",
    });
  });

  it("returns the saved translation with current-source staleness", async () => {
    mocks.translationFindUnique.mockResolvedValue({
      id: "translation-1",
      postId: "post-1",
      locale: "en-US",
      status: "PUBLISHED",
      sourceUpdatedAt,
      sourceHash,
    });

    const response = await GET(request("GET"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { translation: { id: "translation-1" }, stale: false },
    });
  });

  it("publishes only a current translation of a published source", async () => {
    const translationUpdatedAt = new Date("2026-08-08T02:03:04.000Z");
    mocks.translationFindUnique.mockResolvedValue({
      id: "translation-1",
      sourceHash,
      sourceUpdatedAt,
      updatedAt: translationUpdatedAt,
    });

    const response = await PUT(request("PUT", {
      ...translationFields,
      status: "PUBLISHED",
      updatedAt: translationUpdatedAt.toISOString(),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.translationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "translation-1", updatedAt: translationUpdatedAt, sourceHash },
      data: expect.objectContaining({
        status: "PUBLISHED",
        publishedAt: expect.any(Date),
      }),
    }));
  });

  it("does not demote a published English version through the draft-save endpoint", async () => {
    const translationUpdatedAt = new Date("2026-08-08T02:03:04.000Z");
    mocks.translationFindUnique.mockResolvedValue({
      id: "translation-1",
      status: "PUBLISHED",
      sourceHash,
      sourceUpdatedAt,
      updatedAt: translationUpdatedAt,
    });

    const response = await PUT(request("PUT", {
      ...translationFields,
      status: "DRAFT",
      updatedAt: translationUpdatedAt.toISOString(),
    }), context);

    expect(response.status).toBe(409);
    expect(mocks.translationUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects manual drafts that drop source URLs or code blocks", async () => {
    const protectedSource = {
      ...sourcePost,
      content: "## Download\n\nUse `pnpm build` and visit https://example.test/file.",
    };
    const protectedHash = computePostTranslationSourceHash(protectedSource);
    const translationUpdatedAt = new Date("2026-08-08T02:03:04.000Z");
    mocks.postFindFirst.mockResolvedValue(protectedSource);
    mocks.translationFindUnique.mockResolvedValue({
      id: "translation-1",
      sourceHash: protectedHash,
      sourceUpdatedAt,
      updatedAt: translationUpdatedAt,
    });

    const response = await PUT(request("PUT", {
      ...translationFields,
      content: "## Download\n\nUse the build command and visit the download page.",
      status: "DRAFT",
      updatedAt: translationUpdatedAt.toISOString(),
    }), context);

    expect(response.status).toBe(422);
    expect(mocks.translationUpdateMany).not.toHaveBeenCalled();
  });
});
