import { describe, expect, it } from "vitest";
import { detectImageType, isAllowedImageBuffer } from "@/lib/image-magic";
import {
  normalizeUploadPurpose,
  UPLOAD_MAX_INPUT_PIXELS,
  UPLOAD_PURPOSES,
} from "@/lib/upload-config";
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
    expect(UPLOAD_PURPOSES.cover.maxWidth).toBe(1280);
    expect(UPLOAD_PURPOSES.cover.maxHeight).toBe(720);
    expect(UPLOAD_PURPOSES.cover.quality).toBeLessThanOrEqual(74);
    expect(UPLOAD_PURPOSES.cover.targetBytes).toBeLessThanOrEqual(420 * 1024);
    expect(UPLOAD_PURPOSES.daily.quality).toBeGreaterThan(0);
    expect(UPLOAD_MAX_INPUT_PIXELS).toBe(25_000_000);
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

  it("keeps a photographic cover below its delivery budget", async () => {
    const width = 1280;
    const height = 720;
    const pixels = Buffer.allocUnsafe(width * height * 3);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = (index * 31 + Math.floor(index / 97)) % 256;
    }
    const source = await (await import("sharp"))
      .default(pixels, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const result = await processUploadImage(source, "cover");

    expect(result.width).toBeLessThanOrEqual(1280);
    expect(result.height).toBeLessThanOrEqual(720);
    expect(result.compressedBytes).toBeLessThanOrEqual(UPLOAD_PURPOSES.cover.targetBytes);
  });
});
