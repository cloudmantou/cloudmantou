import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_PAID_POST_CONTENT_LENGTH,
  preparePaidPostSubmission,
} from "@/lib/paid-post-publishing";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireAdminAndAudit: vi.fn(),
  findUnique: vi.fn(),
  postCreate: vi.fn(),
  postUpdateMany: vi.fn(),
  postTagCreateMany: vi.fn(),
  postTagDeleteMany: vi.fn(),
  paidContentCreate: vi.fn(),
  paidContentDeleteMany: vi.fn(),
  postTranslationUpdateMany: vi.fn(),
  transaction: vi.fn(),
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
  requireAdmin: mocks.requireAdmin,
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

const postId = "post-paid-1";
const postUrl = "https://cloudmantou.test/api/admin/posts";
const updateUrl = `${postUrl}/${postId}`;
const paidContent = { content: "# Members only", price: 9.9 };

function request(method: "POST" | "PUT", body: object, url = postUrl) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    slug: "paid-post",
    publishedAt: null,
    updatedAt: new Date("2026-08-04T01:00:00.000Z"),
    status: "DRAFT",
    paidContent: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  mocks.postCreate.mockResolvedValue({ id: postId, slug: "paid-post" });
  mocks.postUpdateMany.mockResolvedValue({ count: 1 });
  mocks.postTagCreateMany.mockResolvedValue({ count: 0 });
  mocks.postTagDeleteMany.mockResolvedValue({ count: 0 });
  mocks.paidContentCreate.mockResolvedValue({ id: "paid-content-1" });
  mocks.paidContentDeleteMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (operation) => operation({
    post: {
      create: mocks.postCreate,
      updateMany: mocks.postUpdateMany,
    },
    postTag: {
      createMany: mocks.postTagCreateMany,
      deleteMany: mocks.postTagDeleteMany,
    },
    paidContent: {
      create: mocks.paidContentCreate,
      deleteMany: mocks.paidContentDeleteMany,
    },
    postTranslation: { updateMany: mocks.postTranslationUpdateMany },
  }));
});

describe("paid post publishing invariants", () => {
  it("requires both paid editor fields before creating a PAID_ONLY post", async () => {
    const response = await POST(request("POST", {
      title: "Paid guide",
      slug: "paid-guide",
      content: "Public preview",
      status: "PAID_ONLY",
    }));

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { content: "Members only", price: 0 },
    { content: "Members only", price: -1 },
    { content: "Members only", price: 9.999 },
  ])("rejects an illegal PAID_ONLY price: %j", async (paidContent) => {
    const response = await POST(request("POST", {
      title: "Paid guide",
      slug: "paid-guide",
      content: "Public preview",
      status: "PAID_ONLY",
      paidContent,
    }));

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects paid content that exceeds the server-side size limit", async () => {
    const response = await POST(request("POST", {
      title: "Paid guide",
      slug: "paid-guide",
      content: "Public preview",
      status: "PAID_ONLY",
      paidContent: {
        content: "x".repeat(MAX_PAID_POST_CONTENT_LENGTH + 1),
        price: 9.9,
      },
    }));

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a PAID_ONLY post as published and persists its paid content together", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(request("POST", {
      title: "Paid guide",
      slug: "paid-guide",
      content: "Public preview",
      status: "PAID_ONLY",
      paidContent,
    }));

    expect(response.status).toBe(200);
    expect(mocks.postCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PAID_ONLY",
        publishedAt: expect.any(Date),
      }),
    }));
    expect(mocks.paidContentCreate).toHaveBeenCalledWith({
      data: { postId, ...paidContent },
    });
  });

  it("keeps a configured paid article unpublished when creating a draft", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(request("POST", {
      title: "Paid guide draft",
      slug: "paid-guide-draft",
      content: "Public preview",
      status: "DRAFT",
      paidContent,
    }));

    expect(response.status).toBe(200);
    expect(mocks.postCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DRAFT", publishedAt: null }),
    }));
    expect(mocks.paidContentCreate).toHaveBeenCalledWith({
      data: { postId, ...paidContent },
    });
  });

  it("rejects paid content paired with a non-paid create status", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(request("POST", {
      title: "Public guide",
      slug: "public-guide",
      content: "Public body",
      status: "PUBLISHED",
      paidContent,
    }));

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps a concurrent create slug collision to a conflict", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockRejectedValue({
      code: "P2002",
      meta: { target: ["slug"] },
    });

    const response = await POST(request("POST", {
      title: "Public guide",
      slug: "same-slug",
      content: "Public body",
      status: "PUBLISHED",
    }));

    expect(response.status).toBe(409);
  });

  it("requires paid content when an existing free post is switched to PAID_ONLY", async () => {
    mocks.findUnique.mockResolvedValue(makePost({ status: "PUBLISHED", publishedAt: new Date("2026-08-04T00:00:00.000Z") }));

    const response = await PUT(request("PUT", { status: "PAID_ONLY" }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("publishes a PAID_ONLY transition and saves its paid content atomically", async () => {
    mocks.findUnique.mockResolvedValue(makePost());

    const response = await PUT(request("PUT", {
      status: "PAID_ONLY",
      paidContent,
    }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: postId }),
      data: expect.objectContaining({
        status: "PAID_ONLY",
        publishedAt: expect.any(Date),
      }),
    }));
    expect(mocks.paidContentCreate).toHaveBeenCalledWith({
      data: { postId, ...paidContent },
    });
  });

  it("updates paid settings while keeping an article in draft", async () => {
    mocks.findUnique.mockResolvedValue(makePost());

    const response = await PUT(request("PUT", {
      status: "DRAFT",
      paidContent,
    }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DRAFT", publishedAt: null }),
    }));
    expect(mocks.paidContentCreate).toHaveBeenCalledWith({
      data: { postId, ...paidContent },
    });
  });

  it("keeps existing paid content when an already-paid post is edited without a replacement", async () => {
    mocks.findUnique.mockResolvedValue(makePost({
      status: "PAID_ONLY",
      publishedAt: new Date("2026-08-04T00:00:00.000Z"),
      paidContent: { id: "paid-content-1" },
    }));

    const response = await PUT(request("PUT", { title: "Renamed paid guide" }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.paidContentDeleteMany).not.toHaveBeenCalled();
    expect(mocks.paidContentCreate).not.toHaveBeenCalled();
  });

  it("removes paid content when an existing paid post is switched back to public", async () => {
    const firstPublishedAt = new Date("2026-08-04T00:00:00.000Z");
    mocks.findUnique.mockResolvedValue(makePost({
      status: "PAID_ONLY",
      publishedAt: firstPublishedAt,
      paidContent: { id: "paid-content-1" },
    }));

    const response = await PUT(request("PUT", { status: "PUBLISHED" }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PUBLISHED",
        publishedAt: firstPublishedAt,
      }),
    }));
    expect(mocks.paidContentDeleteMany).toHaveBeenCalledWith({ where: { postId } });
  });

  it("rejects paid content paired with a non-paid update status", async () => {
    mocks.findUnique.mockResolvedValue(makePost({ status: "PUBLISHED", publishedAt: new Date("2026-08-04T00:00:00.000Z") }));

    const response = await PUT(request("PUT", {
      status: "PUBLISHED",
      paidContent,
    }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a conflict without changing paid content after a concurrent update", async () => {
    const staleUpdatedAt = new Date("2026-08-04T01:00:00.000Z");
    mocks.findUnique.mockResolvedValue(makePost({ updatedAt: staleUpdatedAt }));
    mocks.postUpdateMany.mockResolvedValue({ count: 0 });
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(staleUpdatedAt.getTime());

    try {
      const response = await PUT(request("PUT", {
        status: "PAID_ONLY",
        paidContent,
      }, updateUrl), {
        params: Promise.resolve({ id: postId }),
      });

      expect(response.status).toBe(409);
      expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: postId, updatedAt: staleUpdatedAt },
        data: expect.objectContaining({
          updatedAt: new Date(staleUpdatedAt.getTime() + 1),
        }),
      }));
      expect(mocks.paidContentDeleteMany).not.toHaveBeenCalled();
      expect(mocks.paidContentCreate).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("maps a concurrent update slug collision to a conflict", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(makePost())
      .mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValue({
      code: "P2002",
      meta: { target: "posts_slug_key" },
    });

    const response = await PUT(request("PUT", {
      slug: "same-slug",
    }, updateUrl), {
      params: Promise.resolve({ id: postId }),
    });

    expect(response.status).toBe(409);
  });
});

describe("paid post editor submission", () => {
  it("keeps a paid article private when saving a configured draft", () => {
    expect(preparePaidPostSubmission({
      mode: "create",
      requestedStatus: "DRAFT",
      isPaid: true,
      paidContent: "  # Members only  ",
      paidPrice: "9.90",
    })).toEqual({
      ok: true,
      status: "DRAFT",
      paidContent: { content: "# Members only", price: 9.9 },
    });
  });

  it("requires complete paid fields before publishing", () => {
    expect(preparePaidPostSubmission({
      mode: "create",
      requestedStatus: "PAID_ONLY",
      isPaid: true,
      paidContent: "",
      paidPrice: "9.90",
    })).toEqual({ ok: false, error: "付费内容和价格需要同时填写" });
  });

  it.each(["9.99元", "9.999", "0", "-1", "Infinity"])(
    "rejects an unsafe editor price: %s",
    (paidPrice) => {
      const result = preparePaidPostSubmission({
        mode: "create",
        requestedStatus: "PAID_ONLY",
        isPaid: true,
        paidContent: "Members only",
        paidPrice,
      });

      expect(result).toEqual({ ok: false, error: "付费价格必须是大于等于 0.01 的两位小数" });
    },
  );

  it("clears paid content when an edited article is changed to public", () => {
    expect(preparePaidPostSubmission({
      mode: "edit",
      requestedStatus: "PUBLISHED",
      isPaid: false,
      paidContent: "old paid body",
      paidPrice: "9.90",
    })).toEqual({ ok: true, status: "PUBLISHED", paidContent: null });
  });
});
