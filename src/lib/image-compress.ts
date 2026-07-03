import {
  getClientCompressOptions,
  type UploadPurpose,
} from "@/lib/upload-config";

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
  purpose?: UploadPurpose;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

function scaleDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * 客户端图片压缩：等比缩放 + WebP 输出（减轻上传带宽，服务端会再次校验并压缩）
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const preset = options.purpose ? getClientCompressOptions(options.purpose) : null;
  const opts = {
    maxWidth: options.maxWidth ?? preset?.maxWidth ?? 1920,
    maxHeight: options.maxHeight ?? preset?.maxHeight ?? 1920,
    quality: options.quality ?? preset?.quality ?? 0.82,
    mimeType: options.mimeType ?? preset?.mimeType ?? "image/webp",
  };

  const img = await loadImage(file);
  const { width, height } = scaleDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("图片压缩失败"))),
      opts.mimeType,
      opts.quality
    );
  });

  const ext = opts.mimeType === "image/jpeg" ? "jpg" : "webp";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${ext}`, { type: opts.mimeType });
}