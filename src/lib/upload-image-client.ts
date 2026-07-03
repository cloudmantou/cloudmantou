import { compressImage } from "@/lib/image-compress";

export async function uploadImageFile(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; forCover?: boolean }
): Promise<string> {
  const compressed = await compressImage(file, {
    maxWidth: options?.forCover ? 1600 : 1920,
    maxHeight: options?.forCover ? 900 : 1920,
    quality: options?.forCover ? 0.85 : 0.82,
    mimeType: "image/webp",
  });

  const formData = new FormData();
  formData.append("file", compressed);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "图片上传失败");
  }

  return data.data.url as string;
}