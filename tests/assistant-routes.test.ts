import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), requireAdmin: vi.fn(), limited: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { assistantInstallManifest: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update, findMany: mocks.findMany }, assistantServiceSnapshot: { findMany: mocks.findMany } } }));
vi.mock("@/lib/guards", async () => {
  const { ApiError } = await import("@/lib/api-error");
  return { requireAdmin: mocks.requireAdmin, ApiError };
});
vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: mocks.limited, getClientIP: () => "127.0.0.1" }));
vi.mock("@/lib/assistant-services", () => ({ readIPAToolStatus: mocks.status }));
import { GET as create } from "../src/app/api/assistant/manifest/route";
import { GET as read, HEAD } from "../src/app/api/assistant/manifests/[file]/route";
import { GET as monitor } from "../src/app/api/admin/assistant-services/route";
import { ApiError } from "../src/lib/api-error";
import { decryptSecret, encryptSecret } from "../src/lib/secret-crypto";

const params = new URLSearchParams({ bundle_id: "com.test.app", bundle_version: "1", title: "测试安装", nonce: "a".repeat(32), client_ip: "192.168.1.20", route: "/private-ticket/app.ipa", port: "7890" });
beforeEach(() => { vi.resetAllMocks(); mocks.limited.mockResolvedValue(null); mocks.create.mockResolvedValue({}); mocks.findMany.mockResolvedValue([]); mocks.status.mockResolvedValue([]); });
describe("assistant route compatibility and access control", () => {
  it("returns the exact legacy envelope, encrypted local URL, and no upload step", async () => {
    const response = await create(new Request(`https://blog.test/api/assistant/manifest?${params}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["manifest_url", "itms", "nonce", "ipa_url"].sort());
    expect(body.manifest_url).toMatch(/^https:\/\/install.cloudmantoua.top\/backend\/manifests\/[a-f0-9]{32}\.plist$/);
    expect(body.ipa_url).toBe("http://192.168.1.20:7890/private-ticket/app.ipa");
    const record = mocks.create.mock.calls[0][0].data;
    expect(record.encryptedPlist).not.toContain("private-ticket");
    expect(decryptSecret(record.encryptedPlist)).toContain(body.ipa_url);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects traversal before database access and respects distributed limits", async () => {
    const bad = new URLSearchParams(params); bad.set("nonce", "../overwrite");
    expect((await create(new Request(`https://blog.test/?${bad}`))).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
    mocks.limited.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await create(new Request(`https://blog.test/?${params}`))).status).toBe(429);
  });
  it("does not allow expired or malformed manifest references", async () => {
    const request = new Request("https://blog.test/");
    expect((await read(request, { params: Promise.resolve({ file: "../bad.plist" }) })).status).toBe(404);
    mocks.findUnique.mockResolvedValue({ expiresAt: new Date(0) });
    expect((await read(request, { params: Promise.resolve({ file: `${"a".repeat(32)}.plist` }) })).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns a plist to the installer without blog login; HEAD never counts as a fetch", async () => {
    const file = `${"a".repeat(32)}.plist`;
    mocks.findUnique.mockResolvedValue({ id: file.slice(0, -6), expiresAt: new Date(Date.now() + 60000), encryptedPlist: encryptSecret('<?xml version="1.0"?><plist/>') });
    expect((await HEAD(new Request("https://blog.test/", { method: "HEAD" }), { params: Promise.resolve({ file }) })).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    const response = await read(new Request("https://blog.test/"), { params: Promise.resolve({ file }) });
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("plist"); expect(mocks.update).toHaveBeenCalledOnce();
  });
  it("requires admin before reading operational data", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("请先登录", 40100, 401));
    expect((await monitor()).status).toBe(401); expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("never selects encrypted local authorization paths for the dashboard", async () => {
    const response = await monitor(); expect(response.status).toBe(200);
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("encryptedPlist");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
