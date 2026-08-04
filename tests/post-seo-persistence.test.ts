import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  findUnique: vi.fn(),
  postCreate: vi.fn(),
  postUpdateMany: vi.fn(),
  postTagDeleteMany: vi.fn(),
  paidContentDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: number, public status: number) {
      super(message);
    }
  },
  requireAdmin: vi.fn(),
  requireAdminAndAudit: mocks.requireAdminAndAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/admin/posts/route";
import { PUT } from "@/app/api/admin/posts/[id]/route";

function request(method: "POST" | "PUT", body: object, suffix = "") {
  return new NextRequest(`https://cloudmantou.test/api/admin/posts${suffix}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const metadata = {
  seoTitle: "iOS 应用降级方法与适用条件",
  seoDescription: "说明 iOS 应用降级的适用条件、准备工作、操作步骤和限制。",
  seoKeywords: ["iOS 应用降级", "iOS 应用降级", "App Store 旧版本"],
  socialTitle: "iOS 应用降级：条件与步骤",
  socialDescription: "从适用条件到常见问题，完整说明 iOS 应用降级。",
};

describe("article SEO persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.postCreate.mockResolvedValue({ id: "post-1", slug: "ios-downgrade" });
    mocks.postUpdateMany.mockResolvedValue({ count: 1 });
    mocks.postTagDeleteMany.mockResolvedValue({ count: 0 });
    mocks.paidContentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation(async (operation) => operation({
      post: { create: mocks.postCreate, updateMany: mocks.postUpdateMany },
      postTag: { createMany: vi.fn(), deleteMany: mocks.postTagDeleteMany },
      paidContent: { create: vi.fn(), deleteMany: mocks.paidContentDeleteMany },
    }));
  });

  it("creates a post with normalized SEO and social fields", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(request("POST", {
      title: "iOS 应用降级",
      slug: "ios-downgrade",
      content: "这是一篇说明 iOS 应用降级条件和步骤的公开文章。",
      status: "PUBLISHED",
      ...metadata,
    }));

    expect(response.status).toBe(200);
    expect(mocks.postCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ...metadata,
        seoKeywords: ["iOS 应用降级", "App Store 旧版本"],
      }),
    }));
  });

  it("updates only supplied metadata and rejects oversized keyword sets", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "post-1",
      slug: "ios-downgrade",
      status: "PUBLISHED",
      publishedAt: new Date("2026-08-04T00:00:00Z"),
      updatedAt: new Date("2026-08-04T01:00:00Z"),
      paidContent: null,
    });

    const response = await PUT(request("PUT", metadata, "/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        seoTitle: metadata.seoTitle,
        seoKeywords: ["iOS 应用降级", "App Store 旧版本"],
        socialDescription: metadata.socialDescription,
      }),
    }));

    const invalid = await PUT(request("PUT", {
      seoKeywords: Array.from({ length: 13 }, (_, index) => `关键词-${index}`),
    }, "/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    expect(invalid.status).toBe(422);
  });
});
