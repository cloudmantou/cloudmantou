import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  auditAdminAction: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/guards", () => {
  class ApiError extends Error {
    code: number;
    status: number;

    constructor(message: string, code: number, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  return { ApiError, requireAdmin: mocks.requireAdmin };
});

vi.mock("@/lib/admin-audit-log", () => ({
  auditAdminAction: mocks.auditAdminAction,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeApp: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}));

import { ApiError } from "@/lib/guards";
import { GET, POST } from "@/app/api/admin/store-apps/route";
import { DELETE, PUT } from "@/app/api/admin/store-apps/[id]/route";

const adminSession = { user: { id: "admin-1", role: "ADMIN" } };
const existingApp = {
  id: "app-1",
  name: "示例应用",
  slug: "example-app",
  tagline: null,
  description: "示例描述",
  iconUrl: null,
  coverUrl: null,
  screenshots: [],
  category: "TOOL",
  featured: false,
  sortOrder: 10,
  published: false,
  installUrl: null,
  minIos: "15.0",
  createdAt: new Date("2026-07-19T00:00:00.000Z"),
  updatedAt: new Date("2026-07-19T00:00:00.000Z"),
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(adminSession);
  mocks.auditAdminAction.mockResolvedValue(undefined);
});

describe("GET /api/admin/store-apps", () => {
  it("未登录时返回 401 且不查询 StoreApp", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("请先登录", 40100, 401));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("管理员可按排序读取全部应用", async () => {
    mocks.findMany.mockResolvedValue([existingApp]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    expect((await response.json()).data).toHaveLength(1);
  });
});

describe("POST /api/admin/store-apps", () => {
  it("拒绝危险安装协议且不写库、不审计", async () => {
    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/store-apps", "POST", {
        name: "危险应用",
        slug: "danger-app",
        description: "不应被创建",
        category: "TOOL",
        installUrl: "javascript:alert(1)",
      })
    );

    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.auditAdminAction).not.toHaveBeenCalled();
  });

  it("创建后记录不含敏感内容的管理员审计", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ ...existingApp, id: "app-new" });
    const request = jsonRequest("http://localhost:3000/api/admin/store-apps", "POST", {
      name: "示例应用",
      slug: "example-app",
      description: "示例描述",
      category: "TOOL",
      installUrl: "mantou://store/example-app",
      sortOrder: 10,
      published: false,
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.auditAdminAction).toHaveBeenCalledWith(
      request,
      "admin-1",
      "store_apps.create",
      expect.objectContaining({ targetType: "store_app", targetId: "app-new" })
    );
    expect(JSON.stringify(mocks.auditAdminAction.mock.calls[0])).not.toContain("mantou://");
  });
});

describe("PUT /api/admin/store-apps/:id", () => {
  it("支持上下架和排序并记录审计", async () => {
    mocks.findUnique.mockResolvedValue(existingApp);
    mocks.update.mockResolvedValue({ ...existingApp, published: true, sortOrder: 2 });
    const request = jsonRequest("http://localhost:3000/api/admin/store-apps/app-1", "PUT", {
      published: true,
      sortOrder: 2,
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "app-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { published: true, sortOrder: 2 },
    });
    expect(mocks.auditAdminAction).toHaveBeenCalledWith(
      request,
      "admin-1",
      "store_apps.update",
      expect.objectContaining({ targetType: "store_app", targetId: "app-1" })
    );
  });
});

describe("DELETE /api/admin/store-apps/:id", () => {
  it("删除后记录管理员审计", async () => {
    mocks.findUnique.mockResolvedValue(existingApp);
    mocks.delete.mockResolvedValue(existingApp);
    const request = new NextRequest("http://localhost:3000/api/admin/store-apps/app-1", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "app-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "app-1" } });
    expect(mocks.auditAdminAction).toHaveBeenCalledWith(
      request,
      "admin-1",
      "store_apps.delete",
      expect.objectContaining({ targetType: "store_app", targetId: "app-1" })
    );
  });
});
