import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadRoot: "",
  getUploadRoot: vi.fn(() => mocks.uploadRoot),
}));

vi.mock("@/lib/local-storage", () => ({
  getUploadRoot: mocks.getUploadRoot,
}));

import { GET } from "@/app/uploads/[...path]/route";

describe("persistent upload delivery route", () => {
  beforeEach(async () => {
    mocks.uploadRoot = await mkdtemp(path.join(os.tmpdir(), "cloudmantou-uploads-"));
  });

  afterEach(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(mocks.uploadRoot, { recursive: true, force: true }));
    vi.clearAllMocks();
  });

  it("serves a nested WebP from the configured persistent upload root", async () => {
    const directory = path.join(mocks.uploadRoot, "2026", "08");
    await mkdir(directory, { recursive: true });
    const image = Buffer.from("RIFF-fixture-WEBP", "utf8");
    await writeFile(path.join(directory, "cover.webp"), image);

    const response = await GET(new Request("https://cloudmantoua.top/uploads/2026/08/cover.webp"), {
      params: Promise.resolve({ path: ["2026", "08", "cover.webp"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
  });

  it("returns 404 for missing files and traversal segments", async () => {
    const missing = await GET(new Request("https://cloudmantoua.top/uploads/missing.webp"), {
      params: Promise.resolve({ path: ["missing.webp"] }),
    });
    const traversal = await GET(new Request("https://cloudmantoua.top/uploads/../secret.webp"), {
      params: Promise.resolve({ path: ["..", "secret.webp"] }),
    });

    expect(missing.status).toBe(404);
    expect(traversal.status).toBe(404);
  });

  it("does not follow an image-named symlink outside the upload root", async () => {
    await symlink("/etc/hosts", path.join(mocks.uploadRoot, "escape.webp"));

    const response = await GET(new Request("https://cloudmantoua.top/uploads/escape.webp"), {
      params: Promise.resolve({ path: ["escape.webp"] }),
    });

    expect(response.status).toBe(404);
  });
});
