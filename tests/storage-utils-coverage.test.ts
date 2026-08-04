import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mkdirMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

import { compressImage } from "@/lib/image-compress";
import {
  buildUploadFolder,
  ensureUploadRoot,
  getUploadRoot,
  resolveUploadRoot,
  saveUploadBuffer,
  saveUploadBufferDeduplicated,
} from "@/lib/local-storage";
import {
  getClientCompressOptions,
  normalizeUploadPurpose,
  UPLOAD_MAX_INPUT_BYTES,
  UPLOAD_MAX_OUTPUT_BYTES,
  UPLOAD_PURPOSES,
} from "@/lib/upload-config";

type ImageEnvironmentOptions = {
  naturalWidth?: number;
  naturalHeight?: number;
  imageError?: boolean;
  contextAvailable?: boolean;
  blobAvailable?: boolean;
};

function installImageEnvironment(options: ImageEnvironmentOptions = {}) {
  const {
    naturalWidth = 4000,
    naturalHeight = 2000,
    imageError = false,
    contextAvailable = true,
    blobAvailable = true,
  } = options;
  const drawImage = vi.fn();
  const createObjectURL = vi.fn(() => "blob:test-image");
  const revokeObjectURL = vi.fn();
  const toBlob = vi.fn(
    (
      callback: (blob: Blob | null) => void,
      mimeType?: string,
      _quality?: number
    ) => {
      callback(blobAvailable ? new Blob(["compressed"], { type: mimeType }) : null);
    }
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (contextAvailable ? { drawImage } : null)),
    toBlob,
  };

  class FakeImage {
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => {
        if (imageError) this.onerror?.();
        else this.onload?.();
      });
    }
  }

  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("document", {
    createElement: vi.fn((tag: string) => {
      if (tag !== "canvas") throw new Error(`unexpected element: ${tag}`);
      return canvas;
    }),
  });

  return { canvas, createObjectURL, revokeObjectURL, drawImage, toBlob };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.UPLOAD_DIR;
  delete process.env.UPLOAD_ALLOWED_ROOT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UPLOAD_DIR;
  delete process.env.UPLOAD_ALLOWED_ROOT;
});

describe("upload configuration", () => {
  it("normalizes every supported purpose and falls back for missing values", () => {
    for (const purpose of ["cover", "content", "daily", "general"] as const) {
      expect(normalizeUploadPurpose(purpose)).toBe(purpose);
    }
    expect(normalizeUploadPurpose(null)).toBe("general");
    expect(normalizeUploadPurpose(undefined)).toBe("general");
    expect(normalizeUploadPurpose("avatar")).toBe("general");
  });

  it("maps server percentages to client compression options", () => {
    expect(getClientCompressOptions("cover")).toEqual({
      maxWidth: UPLOAD_PURPOSES.cover.maxWidth,
      maxHeight: UPLOAD_PURPOSES.cover.maxHeight,
      quality: UPLOAD_PURPOSES.cover.quality / 100,
      mimeType: "image/webp",
    });
    expect(UPLOAD_MAX_INPUT_BYTES).toBe(10 * 1024 * 1024);
    expect(UPLOAD_MAX_OUTPUT_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("compressImage", () => {
  it("scales proportionally and honors explicit JPEG options", async () => {
    const browser = installImageEnvironment();
    const source = new File(["source"], "photo.png", { type: "image/png" });

    const result = await compressImage(source, {
      maxWidth: 1000,
      maxHeight: 1000,
      quality: 0.5,
      mimeType: "image/jpeg",
    });

    expect(browser.canvas.width).toBe(1000);
    expect(browser.canvas.height).toBe(500);
    expect(browser.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1000, 500);
    expect(browser.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.5);
    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:test-image");
  });

  it("uses purpose presets and keeps smaller images at their natural size", async () => {
    const browser = installImageEnvironment({ naturalWidth: 800, naturalHeight: 450 });
    const source = new File(["source"], "cover", { type: "image/png" });

    const result = await compressImage(source, { purpose: "cover" });

    expect(browser.canvas.width).toBe(800);
    expect(browser.canvas.height).toBe(450);
    expect(browser.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      UPLOAD_PURPOSES.cover.quality / 100,
    );
    expect(result.name).toBe("cover.webp");
  });

  it("uses general defaults when no purpose or options are provided", async () => {
    const browser = installImageEnvironment({ naturalWidth: 3840, naturalHeight: 2160 });

    await compressImage(new File(["source"], "wide.png"));

    expect(browser.canvas.width).toBe(1920);
    expect(browser.canvas.height).toBe(1080);
    expect(browser.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.82);
  });

  it("revokes the object URL and rejects image decode failures", async () => {
    const browser = installImageEnvironment({ imageError: true });

    await expect(compressImage(new File(["bad"], "bad.png"))).rejects.toThrow(
      "图片加载失败"
    );
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:test-image");
  });

  it("rejects unavailable canvas contexts and failed blob encoding", async () => {
    installImageEnvironment({ contextAvailable: false });
    await expect(compressImage(new File(["source"], "image.png"))).rejects.toThrow(
      "无法创建画布"
    );

    installImageEnvironment({ blobAvailable: false });
    await expect(compressImage(new File(["source"], "image.png"))).rejects.toThrow(
      "图片压缩失败"
    );
  });
});

describe("local upload storage", () => {
  it("resolves the default root and safe relative descendants", () => {
    const defaultRoot = path.resolve(process.cwd(), "public", "uploads");

    expect(resolveUploadRoot()).toBe(defaultRoot);
    expect(getUploadRoot()).toBe(defaultRoot);
    expect(resolveUploadRoot("public/uploads/avatars")).toBe(
      path.join(defaultRoot, "avatars")
    );
  });

  it("rejects traversal and paths outside the allowed roots", () => {
    expect(() => resolveUploadRoot("../outside")).toThrow("must not contain '..'");
    expect(() => resolveUploadRoot(path.resolve(process.cwd(), "private"))).toThrow(
      "outside allowed directories"
    );
  });

  it("accepts an absolute path only when explicitly allowlisted", () => {
    const customRoot = path.resolve(process.cwd(), ".tmp", "uploads");
    process.env.UPLOAD_ALLOWED_ROOT = customRoot;
    process.env.UPLOAD_DIR = `  ${customRoot}  `;

    expect(getUploadRoot()).toBe(customRoot);
  });

  it("builds deterministic year/month folders", () => {
    expect(buildUploadFolder(new Date(2026, 0, 15))).toBe("2026/01");
    expect(buildUploadFolder(new Date(2026, 10, 1))).toBe("2026/11");
  });

  it("creates the root recursively", async () => {
    const root = path.resolve(process.cwd(), "public", "uploads");

    await expect(ensureUploadRoot()).resolves.toBe(root);
    expect(mkdirMock).toHaveBeenCalledWith(root, { recursive: true });
  });

  it("writes upload buffers and returns public metadata", async () => {
    const buffer = Buffer.from("image-bytes");
    const result = await saveUploadBuffer(buffer, "webp", "2026/07");
    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "2026", "07");

    expect(result.bytes).toBe(buffer.length);
    expect(result.folder).toBe("2026/07");
    expect(result.filename).toMatch(/^[0-9a-f-]+\.webp$/);
    expect(result.url).toBe(`/uploads/2026/07/${result.filename}`);
    expect(mkdirMock).toHaveBeenCalledWith(uploadDir, { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(uploadDir, result.filename),
      buffer
    );
  });

  it("deduplicates remote imports by the compressed content hash", async () => {
    const buffer = Buffer.from("same-compressed-image");
    const result = await saveUploadBufferDeduplicated(buffer, "webp");

    expect(result.folder).toMatch(/^remote\/[0-9a-f]{2}$/);
    expect(result.filename).toMatch(/^[0-9a-f]{64}\.webp$/);
    expect(result.url).toBe(`/uploads/${result.folder}/${result.filename}`);
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(getUploadRoot(), result.folder, result.filename),
      buffer,
      { flag: "wx" }
    );
  });

  it("treats an existing content-hash file as a successful deduplicated save", async () => {
    writeFileMock.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: "EEXIST" }));

    await expect(
      saveUploadBufferDeduplicated(Buffer.from("existing-image"), "webp")
    ).resolves.toMatchObject({ bytes: Buffer.byteLength("existing-image") });
  });
});
