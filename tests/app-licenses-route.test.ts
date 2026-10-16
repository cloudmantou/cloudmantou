import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), audit: vi.fn(), list: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/guards", () => ({ ApiError: class extends Error { constructor(message: string, public code: number, public status: number) { super(message); } }, requireAdmin: mocks.auth, requireAdminAndStrictAudit: mocks.audit }));
vi.mock("@/lib/app-licenses", async original => ({ ...await original<typeof import("@/lib/app-licenses")>(), listLicenses: mocks.list, mutateLicense: mocks.mutate }));
import { GET, POST } from "@/app/api/admin/app-licenses/route";
import { ApiError } from "@/lib/guards";
function request(body: unknown, origin = "https://cloudmantoua.top") { return new NextRequest("https://cloudmantoua.top/api/admin/app-licenses", { method: "POST", headers: { host: "cloudmantoua.top", origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } }); mocks.audit.mockResolvedValue({}); mocks.list.mockResolvedValue({ rows: [] }); mocks.mutate.mockResolvedValue({ message: "ok" }); });
describe("license administration boundary", () => {
  it.each([401, 403])("rejects unauthorized reads and writes (%s)", async status => {
    mocks.auth.mockRejectedValue(new ApiError("无权限", status * 100, status));
    expect((await GET(new NextRequest("https://cloudmantoua.top/api/admin/app-licenses"))).status).toBe(status);
    expect((await POST(request({ action: "card.generate", count: 1 }))).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("blocks cross-origin mutations before auditing or touching cards", async () => {
    expect((await POST(request({ action: "card.generate", count: 1 }, "https://evil.test"))).status).toBe(403);
    expect(mocks.audit).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("does not mutate if strict auditing fails", async () => {
    mocks.audit.mockRejectedValue(new Error("database down"));
    expect((await POST(request({ action: "card.generate", count: 1 }))).status).toBe(500);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("bounds requests and excludes card secrets from audit details", async () => {
    expect((await POST(request({ action: "card.generate", count: 501 }))).status).toBe(422);
    const response = await POST(request({ action: "card.import", cards: ["PRIVATE-SECRET"] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(mocks.audit.mock.calls[0].slice(1))).not.toContain("PRIVATE-SECRET");
  });
  it("never returns database errors containing card secrets", async () => {
    mocks.mutate.mockRejectedValue(new Error("INSERT secret key PRIVATE-SECRET"));
    const response = await POST(request({ action: "card.generate", count: 1 }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("PRIVATE-SECRET");
  });
});
