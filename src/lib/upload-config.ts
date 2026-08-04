export type UploadPurpose = "cover" | "content" | "daily" | "general";

export const UPLOAD_PURPOSES: Record<
  UploadPurpose,
  { maxWidth: number; maxHeight: number; quality: number; targetBytes: number; label: string }
> = {
  cover: { maxWidth: 1280, maxHeight: 720, quality: 72, targetBytes: 420 * 1024, label: "封面" },
  content: { maxWidth: 1600, maxHeight: 1600, quality: 78, targetBytes: 900 * 1024, label: "正文插图" },
  daily: { maxWidth: 1280, maxHeight: 1280, quality: 76, targetBytes: 640 * 1024, label: "日常动态" },
  general: { maxWidth: 1600, maxHeight: 1600, quality: 78, targetBytes: 900 * 1024, label: "通用" },
};

/** 上传前原始文件上限（客户端压缩后通常远小于此值） */
export const UPLOAD_MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Sharp 解码像素上限，防止体积很小但尺寸异常的图片耗尽内存。 */
export const UPLOAD_MAX_INPUT_PIXELS = 25_000_000;

/** 服务端压缩后单文件上限 */
export const UPLOAD_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export function normalizeUploadPurpose(value: string | null | undefined): UploadPurpose {
  if (value === "cover" || value === "content" || value === "daily" || value === "general") {
    return value;
  }
  return "general";
}

export function getClientCompressOptions(purpose: UploadPurpose) {
  const preset = UPLOAD_PURPOSES[purpose];
  return {
    maxWidth: preset.maxWidth,
    maxHeight: preset.maxHeight,
    quality: preset.quality / 100,
    mimeType: "image/webp" as const,
  };
}
