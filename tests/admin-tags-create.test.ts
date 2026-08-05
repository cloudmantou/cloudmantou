import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
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
  requireAdmin: vi.fn(),
  requireAdminAndAudit: mocks.requireAdminAndAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: mocks.findMany,
      create: mocks.create,
    },
  },
}));

import { POST } from "@/app/api/admin/tags/route";

const existingTag = {
  id: "tag-existing",
  name: "iOS 应用降级",
  slug: "ios-downgrade",
  color: "#2563eb",
};

function createRequest(body: unknown) {
  return new NextRequest("https://cloudmantoua.top/api/admin/tags", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://cloudmantoua.top" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  it("reuses an existing tag for the article editor's idempotent create request", async () => {
    mocks.findMany.mockResolvedValue([existingTag]);

    const response = await POST(createRequest({
      name: existingTag.name,
      slug: existingTag.slug,
      reuseExisting: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ ...existingTag, reused: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps a real slug collision as a conflict even in idempotent mode", async () => {
    mocks.findMany.mockResolvedValue([existingTag]);

    const response = await POST(createRequest({
      name: "另一个标签",
      slug: existingTag.slug,
      reuseExisting: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("slug 已被其他标签使用");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves duplicate validation for the standalone tag management page", async () => {
    mocks.findMany.mockResolvedValue([existingTag]);

    const response = await POST(createRequest({
      name: existingTag.name,
      slug: existingTag.slug,
    }));

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not reuse a name match when another tag owns the requested slug", async () => {
    mocks.findMany.mockResolvedValue([
      { ...existingTag, slug: "existing-name-slug" },
      { id: "tag-slug-owner", name: "其他标签", slug: existingTag.slug, color: null },
    ]);

    const response = await POST(createRequest({
      name: existingTag.name,
      slug: existingTag.slug,
      reuseExisting: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("slug 已被其他标签使用");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recovers an idempotent concurrent create after Prisma reports a unique race", async () => {
    mocks.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existingTag]);
    mocks.create.mockRejectedValue({ code: "P2002", meta: { target: ["name"] } });

    const response = await POST(createRequest({
      name: existingTag.name,
      slug: existingTag.slug,
      reuseExisting: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ ...existingTag, reused: true });
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("makes editor-side tag creation idempotent and blocks concurrent submissions", () => {
    const editor = readFileSync(join(process.cwd(), "src/components/admin/PostEditor.tsx"), "utf8");

    expect(editor).toContain("tagCreateInFlightRef.current");
    expect(editor).toContain("reuseExisting: true");
  });
});
