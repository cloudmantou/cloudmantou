import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";

/** 本地上传根目录，默认 public/uploads，Docker 可通过 UPLOAD_DIR 挂载卷 */
export function getUploadRoot(): string {
  const custom = process.env.UPLOAD_DIR?.trim();
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function buildUploadFolder(date = new Date()): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function ensureUploadRoot(): Promise<string> {
  const root = getUploadRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export async function saveUploadBuffer(
  buffer: Buffer,
  ext: string,
  folder?: string
): Promise<{ url: string; bytes: number; folder: string; filename: string }> {
  const uploadFolder = folder || buildUploadFolder();
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(getUploadRoot(), uploadFolder);
  await mkdir(uploadDir, { recursive: true });
  const absolutePath = path.join(uploadDir, filename);
  await writeFile(absolutePath, buffer);

  return {
    url: `/uploads/${uploadFolder}/${filename}`,
    bytes: buffer.length,
    folder: uploadFolder,
    filename,
  };
}