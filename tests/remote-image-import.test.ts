import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRemoteImage: vi.fn(),
  processUploadImage: vi.fn(),
  saveUploadBufferDeduplicated: vi.fn(),
}));

vi.mock("@/lib/remote-image-import-server", () => ({
  RemoteImageImportError: class RemoteImageImportError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  fetchRemoteImage: mocks.fetchRemoteImage,
}));

vi.mock("@/lib/image-process-server", () => ({
  ImageProcessError: class ImageProcessError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  processUploadImage: mocks.processUploadImage,
}));

vi.mock("@/lib/local-storage", () => ({
  saveUploadBufferDeduplicated: mocks.saveUploadBufferDeduplicated,
}));

import { RemoteImageImportError } from "@/lib/remote-image-import-server";
import { importRemoteImages } from "@/lib/remote-image";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("remote image import service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRemoteImage.mockResolvedValue({
      buffer: TINY_PNG,
      finalUrl: "https://images.example.test/photo.png",
      contentType: "image/png",
    });
    mocks.processUploadImage.mockResolvedValue({
      buffer: Buffer.from("compressed-webp"),
      width: 1200,
      height: 675,
      format: "webp",
      originalBytes: 4096,
      compressedBytes: 1024,
      compressionRatio: 75,
    });
    mocks.saveUploadBufferDeduplicated.mockResolvedValue({
      url: "/uploads/2026/08/fixture.webp",
      bytes: 1024,
      folder: "2026/08",
      filename: "fixture.webp",
    });
  });

  it("downloads, compresses to the requested preset, saves, and returns a local URL", async () => {
    const sourceUrl = "https://images.example.test/photo.png";

    const result = await importRemoteImages([sourceUrl], { purpose: "content" });

    expect(mocks.fetchRemoteImage).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(mocks.processUploadImage).toHaveBeenCalledWith(TINY_PNG, "content");
    expect(mocks.saveUploadBufferDeduplicated).toHaveBeenCalledWith(
      Buffer.from("compressed-webp"),
      "webp",
    );
    expect(result).toEqual({
      items: [
        {
          sourceUrl,
          status: "imported",
          url: "/uploads/2026/08/fixture.webp",
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
  });

  it("deduplicates source URLs while preserving first-seen order", async () => {
    const first = "https://images.example.test/first.png";
    const second = "https://images.example.test/second.png";

    const result = await importRemoteImages([first, first, second, first]);

    expect(mocks.fetchRemoteImage).toHaveBeenCalledTimes(2);
    expect(mocks.fetchRemoteImage).toHaveBeenNthCalledWith(
      1,
      first,
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(mocks.fetchRemoteImage).toHaveBeenNthCalledWith(
      2,
      second,
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(result.items.map((item: { sourceUrl: string }) => item.sourceUrl)).toEqual([
      first,
      second,
    ]);
  });

  it("limits remote image work across simultaneous requests", async () => {
    let active = 0;
    let maxActive = 0;
    mocks.fetchRemoteImage.mockImplementation(async (sourceUrl: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { buffer: TINY_PNG, finalUrl: sourceUrl, contentType: "image/png" };
    });

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        importRemoteImages([`https://images.example.test/${index}.png`]),
      ),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("removes a queued import when its request is aborted", async () => {
    const pendingResolvers: Array<() => void> = [];
    mocks.fetchRemoteImage.mockImplementation(
      (sourceUrl: string) =>
        new Promise((resolve) => {
          pendingResolvers.push(() =>
            resolve({ buffer: TINY_PNG, finalUrl: sourceUrl, contentType: "image/png" }),
          );
        }),
    );

    const first = importRemoteImages(["https://images.example.test/first.png"]);
    const second = importRemoteImages(["https://images.example.test/second.png"]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const controller = new AbortController();
    const queued = importRemoteImages(["https://images.example.test/queued.png"], {
      signal: controller.signal,
      timeoutMs: 100,
    });
    controller.abort();

    pendingResolvers.splice(0).forEach((resolve) => resolve());
    const [, , queuedResult] = await Promise.all([first, second, queued]);

    expect(mocks.fetchRemoteImage).toHaveBeenCalledTimes(2);
    expect(queuedResult.items[0]).toMatchObject({
      sourceUrl: "https://images.example.test/queued.png",
      status: "failed",
      reason: "PROCESS_FAILED",
    });
  });

  it("keeps a batch usable when one remote image fails", async () => {
    const blocked = "https://blocked.example.test/image.png";
    const good = "https://images.example.test/photo.png";
    mocks.fetchRemoteImage
      .mockRejectedValueOnce(new RemoteImageImportError("FORBIDDEN_ADDRESS", "blocked"))
      .mockResolvedValueOnce({
        buffer: TINY_PNG,
        finalUrl: good,
        contentType: "image/png",
      });

    const result = await importRemoteImages([blocked, good]);

    expect(result.items[0]).toEqual({
      sourceUrl: blocked,
      status: "failed",
      reason: "UNSAFE_URL",
    });
    expect(result.items[1]).toMatchObject({
      sourceUrl: good,
      status: "imported",
      url: "/uploads/2026/08/fixture.webp",
    });
    expect(result).toMatchObject({ importedCount: 1, failedCount: 1 });
  });

  it.each([
    ["INVALID_URL", "UNSAFE_URL"],
    ["FORBIDDEN_ADDRESS", "UNSAFE_URL"],
    ["RESPONSE_TOO_LARGE", "TOO_LARGE"],
    ["UNSUPPORTED_IMAGE", "INVALID_IMAGE"],
    ["FETCH_TIMEOUT", "FETCH_FAILED"],
    ["TOO_MANY_REDIRECTS", "FETCH_FAILED"],
    ["FETCH_FAILED", "FETCH_FAILED"],
  ])("maps server error %s to stable batch reason %s", async (serverCode, reason) => {
    mocks.fetchRemoteImage.mockRejectedValueOnce(
      new RemoteImageImportError(
        serverCode as RemoteImageImportError["code"],
        "fixture failure",
      ),
    );

    const result = await importRemoteImages(["https://images.example.test/photo.png"]);

    expect(result.items[0]).toEqual({
      sourceUrl: "https://images.example.test/photo.png",
      status: "failed",
      reason,
    });
    expect(result).toMatchObject({ importedCount: 0, failedCount: 1 });
  });
});
