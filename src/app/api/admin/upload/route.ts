import { NextRequest } from "next/server";
import { requireAdmin, ApiError } from "@/lib/guards";
import { ok, fail } from "@/lib/api-response";
import { processUploadImage, ImageProcessError } from "@/lib/image-process-server";
import { saveUploadBuffer, ensureUploadRoot } from "@/lib/local-storage";
import {
  UPLOAD_MAX_INPUT_BYTES,
  normalizeUploadPurpose,
} from "@/lib/upload-config";
import { isAllowedImageBuffer } from "@/lib/image-magic";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureUploadRoot();

    const formData = await req.formData();
    const file = formData.get("file");
    const purpose = normalizeUploadPurpose(
      typeof formData.get("purpose") === "string" ? String(formData.get("purpose")) : undefined
    );

    if (!file || !(file instanceof File)) {
      return fail("请选择图片文件", 40000, 400);
    }

    if (file.size > UPLOAD_MAX_INPUT_BYTES) {
      return fail(`图片不能超过 ${Math.round(UPLOAD_MAX_INPUT_BYTES / 1024 / 1024)}MB`, 40000, 400);
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (!isAllowedImageBuffer(input)) {
      return fail("仅支持 JPG / PNG / WebP / GIF，且文件头校验未通过", 40000, 400);
    }

    const processed = await processUploadImage(input, purpose);
    const saved = await saveUploadBuffer(processed.buffer, "webp");

    return ok({
      url: saved.url,
      purpose,
      width: processed.width,
      height: processed.height,
      format: processed.format,
      originalBytes: processed.originalBytes,
      compressedBytes: processed.compressedBytes,
      compressionRatio: processed.compressionRatio,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    if (error instanceof ImageProcessError) {
      const status = error.code === "OUTPUT_TOO_LARGE" ? 413 : 400;
      return fail(error.message, 40000, status);
    }
    console.error("[Upload Error]", error);
    return fail("图片上传失败", 50000, 500);
  }
}