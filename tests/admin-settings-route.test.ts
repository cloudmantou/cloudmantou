import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  invalidate: vi.fn(),
  audit: vi.fn(),
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
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/lib/site-settings", () => ({
  DEFAULT_HOME_TYPING_PHRASES: ["Default phrase"],
  invalidateSiteSettingsCache: mocks.invalidate,
}));

vi.mock("@/lib/admin-audit-log", () => ({ auditAdminAction: mocks.audit }));

import { GET, PUT } from "@/app/api/admin/settings/route";

describe("admin settings desktop downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.upsert.mockResolvedValue({});
    mocks.audit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns environment defaults when download rows have not been saved", async () => {
    vi.stubEnv("WINDOWS_DOWNLOAD_URL", "https://downloads.example/default.exe");
    vi.stubEnv("MACOS_DOWNLOAD_URL", "/downloads/default.dmg");

    const response = await GET();
    const body = await response.json();

    expect(body.data).toMatchObject({
      windowsDownloadUrl: "https://downloads.example/default.exe",
      macosDownloadUrl: "/downloads/default.dmg",
    });
  });

  it("returns Windows and macOS download URLs to the management page", async () => {
    mocks.findMany.mockResolvedValue([
      { key: "windowsDownloadUrl", value: "https://downloads.example/mantou.exe" },
      { key: "macosDownloadUrl", value: "/downloads/mantou.dmg" },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      windowsDownloadUrl: "https://downloads.example/mantou.exe",
      macosDownloadUrl: "/downloads/mantou.dmg",
    });
  });

  it("persists normalized Windows and macOS download URLs", async () => {
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        windowsDownloadUrl: " https://downloads.example/mantou.exe ",
        macosDownloadUrl: "/downloads/mantou.dmg",
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenNthCalledWith(1, {
      where: { key: "windowsDownloadUrl" },
      update: { value: "https://downloads.example/mantou.exe", type: "string" },
      create: {
        key: "windowsDownloadUrl",
        value: "https://downloads.example/mantou.exe",
        type: "string",
      },
    });
    expect(mocks.upsert).toHaveBeenNthCalledWith(2, {
      where: { key: "macosDownloadUrl" },
      update: { value: "/downloads/mantou.dmg", type: "string" },
      create: {
        key: "macosDownloadUrl",
        value: "/downloads/mantou.dmg",
        type: "string",
      },
    });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it("rejects unsafe download protocols before writing settings", async () => {
    const request = new NextRequest("https://cloudmantoua.top/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ windowsDownloadUrl: "javascript:alert(1)" }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(422);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
