import sharp from "sharp";
import { detectImageType } from "@/lib/image-magic";
import {
  UPLOAD_MAX_OUTPUT_BYTES,
  UPLOAD_PURPOSES,
  type UploadPurpose,
} from "@/lib/upload-config";

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
    const processed = await sharp(input, { failOn: "error", animated: false })
      .rotate()
      .resize(preset.maxWidth, preset.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: preset.quality,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });

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