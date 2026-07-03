import { compressImage } from "@/lib/image-compress";
import type { UploadPurpose } from "@/lib/upload-config";

export async function uploadImageFile(
  file: File,
  options?: { purpose?: UploadPurpose; forCover?: boolean }
): Promise<string> {
  const purpose: UploadPurpose = options?.purpose || (options?.forCover ? "cover" : "content");

  const compressed = await compressImage(file, { purpose });

  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("purpose", purpose);

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