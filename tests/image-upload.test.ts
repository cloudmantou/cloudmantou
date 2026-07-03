import { describe, expect, it } from "vitest";
import { detectImageType, isAllowedImageBuffer } from "@/lib/image-magic";
import { normalizeUploadPurpose, UPLOAD_PURPOSES } from "@/lib/upload-config";
import { processUploadImage } from "@/lib/image-process-server";

// 1x1 PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("image-magic", () => {
  it("detects PNG from file header", () => {
    expect(detectImageType(TINY_PNG)).toBe("png");
    expect(isAllowedImageBuffer(TINY_PNG)).toBe(true);
  });

  it("rejects non-image buffers", () => {
    expect(detectImageType(Buffer.from("not-an-image"))).toBeNull();
    expect(isAllowedImageBuffer(Buffer.from("hello"))).toBe(false);
  });
});

describe("upload-config", () => {
  it("normalizes unknown purpose to general", () => {
    expect(normalizeUploadPurpose("unknown")).toBe("general");
    expect(normalizeUploadPurpose("cover")).toBe("cover");
  });

  it("defines compression presets for each purpose", () => {
    expect(UPLOAD_PURPOSES.cover.maxWidth).toBe(1600);
    expect(UPLOAD_PURPOSES.daily.quality).toBeGreaterThan(0);
  });
});

describe("image-process-server", () => {
  it("re-encodes PNG to compressed WebP", async () => {
    const result = await processUploadImage(TINY_PNG, "content");
    expect(result.format).toBe("webp");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.compressedBytes).toBeGreaterThan(0);
    expect(result.buffer.subarray(0, 4).toString()).toBe("RIFF");
  });
});