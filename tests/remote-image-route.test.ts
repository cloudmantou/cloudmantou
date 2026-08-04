import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAndAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  importRemoteImages: vi.fn(),
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

vi.mock("@/lib/rate-limit-server", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/remote-image", () => ({
  importRemoteImages: mocks.importRemoteImages,
}));

import { POST } from "@/app/api/admin/images/import/route";

function request(body: unknown) {
  return new NextRequest("https://cloudmantoua.top/api/admin/images/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/images/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAndAudit.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.importRemoteImages.mockResolvedValue({
      items: [],
      importedCount: 0,
      failedCount: 0,
    });
  });

  it("requires an audited admin and user-scoped rate limit before importing", async () => {
    await POST(request({ urls: ["https://images.example.test/photo.png"] }));

    expect(mocks.requireAdminAndAudit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "image.remote-import",
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ scope: "admin-image-import" }),
      "admin-1",
    );
  });

  it("deduplicates at most ten URLs and passes the selected compression purpose", async () => {
    const urls = Array.from(
      { length: 10 },
      (_, index) => `https://images.example.test/${index}.png`,
    );

    const response = await POST(request({ urls: [urls[0], ...urls], purpose: "cover" }));

    expect(response.status).toBe(200);
    expect(mocks.importRemoteImages).toHaveBeenCalledWith(
      urls,
      expect.objectContaining({ purpose: "cover", signal: expect.any(AbortSignal) }),
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(10);
  });

  it.each([
    [{ urls: [] }, 422],
    [{ urls: ["https://images.example.test/photo.png"], purpose: "avatar" }, 422],
    [{ urls: Array.from({ length: 11 }, (_, index) => `https://x.test/${index}.png`) }, 422],
  ])("rejects invalid batch payload %#", async (body, status) => {
    const response = await POST(request(body));

    expect(response.status).toBe(status);
    expect(mocks.importRemoteImages).not.toHaveBeenCalled();
  });

  it("returns imported and failed items in the standard API envelope", async () => {
    mocks.importRemoteImages.mockResolvedValue({
      items: [
        {
          sourceUrl: "https://images.example.test/photo.png",
          status: "imported",
          url: "/uploads/2026/08/photo.webp",
          width: 1200,
          height: 675,
          originalBytes: 4096,
          compressedBytes: 1024,
          compressionRatio: 75,
        },
      ],
      importedCount: 1,
      failedCount: 0,
    });

    const response = await POST(
      request({ urls: ["https://images.example.test/photo.png"], purpose: "content" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: 0,
      data: {
        items: [{ status: "imported", url: "/uploads/2026/08/photo.webp" }],
        importedCount: 1,
        failedCount: 0,
      },
    });
  });
});
