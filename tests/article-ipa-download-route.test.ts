import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const mocks = vi.hoisted(() => ({ find: vi.fn(), auth: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { articleIpaRelease: { findUnique: mocks.find } } }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/post-access", () => ({ getPostAccess: mocks.access }));
vi.mock("@/lib/guards", () => ({ ApiError: class ApiError extends Error {} }));
import { GET, HEAD } from "@/app/api/article-ipa/[id]/download/route";
const root = await mkdtemp(path.join(tmpdir(), "article-ipa-test-"));
const storageKey = "12345678-1234-1234-1234-123456789abc.ipa";
const bytes = Buffer.from("0123456789");
await writeFile(path.join(root, storageKey), bytes);
const originalDir = process.env.IPA_UPLOAD_DIR;
const release = { id: "release", postId: "post", storageKey, bytes: bytes.length, filename: "红笺.ipa", sha256: "a".repeat(64), deletedAt: null, post: { id: "post", status: "PUBLISHED", content: "public", paidContent: null } };
const context = { params: Promise.resolve({ id: "release" }) };
beforeEach(() => {
  vi.clearAllMocks(); process.env.IPA_UPLOAD_DIR = root;
  mocks.find.mockResolvedValue(structuredClone(release)); mocks.auth.mockResolvedValue(null); mocks.access.mockResolvedValue({ hasAccess: false });
});
afterAll(async () => { process.env.IPA_UPLOAD_DIR = originalDir; await rm(root, { recursive: true, force: true }); });
describe("article IPA download authorization and file delivery", () => {
  it("streams exact file bytes and safe attachment headers", async () => {
    const res = await GET(new NextRequest("https://example.test/api/article-ipa/release/download"), context);
    expect(res.status).toBe(200); expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''%E7%BA%A2");
    expect(res.headers.get("cache-control")).toContain("private");
  });
  it("supports resumable byte ranges and rejects out of range requests", async () => {
    const res = await GET(new NextRequest("https://example.test/download", { headers: { range: "bytes=3-5" } }), context);
    expect(res.status).toBe(206); expect(await res.text()).toBe("345");
    expect(res.headers.get("content-range")).toBe("bytes 3-5/10");
    const invalid = await GET(new NextRequest("https://example.test/download", { headers: { range: "bytes=100-" } }), context);
    expect(invalid.status).toBe(416);
  });
  it("provides HEAD without a body", async () => {
    const res = await HEAD(new NextRequest("https://example.test/download", { method: "HEAD" }), context);
    expect(res.headers.get("content-length")).toBe("10"); expect(await res.text()).toBe("");
  });
  it.each([
    { ...release, post: null }, { ...release, deletedAt: new Date() },
    { ...release, post: { ...release.post, status: "DRAFT" } },
  ])("hides unbound, removed and draft downloads", async item => {
    mocks.find.mockResolvedValue(item);
    expect((await GET(new NextRequest("https://example.test/download"), context)).status).toBe(404);
  });
  it("denies locked paid articles and grants entitled readers", async () => {
    mocks.find.mockResolvedValue({ ...release, post: { ...release.post, status: "PAID_ONLY" } });
    expect((await GET(new NextRequest("https://example.test/download"), context)).status).toBe(403);
    mocks.auth.mockResolvedValue({ user: { id: "reader", role: "USER" } }); mocks.access.mockResolvedValue({ hasAccess: true });
    expect((await GET(new NextRequest("https://example.test/download"), context)).status).toBe(200);
  });
  it("does not stream a missing or truncated package", async () => {
    mocks.find.mockResolvedValue({ ...release, bytes: 11 });
    expect((await GET(new NextRequest("https://example.test/download"), context)).status).toBe(404);
  });
});
