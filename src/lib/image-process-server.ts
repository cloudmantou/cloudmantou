import sharp from "sharp";
import { detectImageType } from "@/lib/image-magic";
import {
  UPLOAD_MAX_OUTPUT_BYTES,
  UPLOAD_MAX_INPUT_PIXELS,
  UPLOAD_PURPOSES,
  type UploadPurpose,
} from "@/lib/upload-config";

sharp.concurrency(2);

export type ProcessImageResult = {
  buffer: Buffer;
  width: number;
  height: number;
  format: "webp";
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
};

export class ImageProcessError extends Error {
  code: "INVALID_IMAGE" | "OUTPUT_TOO_LARGE" | "PROCESS_FAILED";

  constructor(code: ImageProcessError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function processUploadImage(
  input: Buffer,
  purpose: UploadPurpose = "general"
): Promise<ProcessImageResult> {
  const detected = detectImageType(input);
  if (!detected) {
    throw new ImageProcessError("INVALID_IMAGE", "文件不是有效的图片格式");
  }

  const preset = UPLOAD_PURPOSES[purpose];

  try {
    const attempts = [
      { width: preset.maxWidth, height: preset.maxHeight, quality: preset.quality },
      { width: preset.maxWidth, height: preset.maxHeight, quality: Math.max(56, preset.quality - 10) },
      { width: preset.maxWidth, height: preset.maxHeight, quality: 50 },
      ...(purpose === "cover"
        ? [
            { width: 1100, height: 619, quality: 56 },
            { width: 960, height: 540, quality: 50 },
            { width: 800, height: 450, quality: 45 },
          ]
        : []),
    ];

    let processed: { data: Buffer; info: { width: number; height: number } } | null = null;
    for (const attempt of attempts) {
      processed = await sharp(input, {
        failOn: "error",
        animated: false,
        limitInputPixels: UPLOAD_MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize(attempt.width, attempt.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: attempt.quality,
          effort: 5,
          smartSubsample: true,
        })
        .toBuffer({ resolveWithObject: true });
      if (processed.data.length <= preset.targetBytes) break;
    }

    if (!processed) {
      throw new ImageProcessError("PROCESS_FAILED", "图片处理失败");
    }

    if (processed.data.length > UPLOAD_MAX_OUTPUT_BYTES) {
      throw new ImageProcessError("OUTPUT_TOO_LARGE", "压缩后图片仍超过大小限制");
    }

    const originalBytes = input.length;
    const compressedBytes = processed.data.length;

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
      format: "webp",
      originalBytes,
      compressedBytes,
      compressionRatio:
        originalBytes > 0 ? Math.round((1 - compressedBytes / originalBytes) * 1000) / 10 : 0,
    };
  } catch (error) {
    if (error instanceof ImageProcessError) throw error;
    console.error("[Image Process Error]", error);
    throw new ImageProcessError("PROCESS_FAILED", "图片处理失败");
  }
}
