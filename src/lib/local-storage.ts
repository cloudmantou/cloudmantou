import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";

const DEFAULT_UPLOAD_REL = path.join("public", "uploads");

function defaultUploadRoot(): string {
  return path.resolve(process.cwd(), DEFAULT_UPLOAD_REL);
}

function allowedUploadRoots(): string[] {
  const roots = [defaultUploadRoot()];
  const extra = process.env.UPLOAD_ALLOWED_ROOT?.trim();
  if (extra) {
    roots.push(path.resolve(extra));
  }
  return roots;
}

function isUnderAllowedRoot(resolved: string): boolean {
  const normalized = path.normalize(resolved);
  return allowedUploadRoots().some(
    (root) => normalized === root || normalized.startsWith(`${root}${path.sep}`)
  );
}

/** 解析并校验上传根目录，拒绝 .. 与越界绝对路径 */
export function resolveUploadRoot(customDir?: string): string {
  const custom = (customDir ?? process.env.UPLOAD_DIR)?.trim();
  if (custom?.includes("..")) {
    throw new Error("UPLOAD_DIR must not contain '..'");
  }

  const resolved = custom
    ? path.isAbsolute(custom)
      ? path.resolve(custom)
      : path.resolve(process.cwd(), custom)
    : defaultUploadRoot();

  const normalized = path.normalize(resolved);
  if (!isUnderAllowedRoot(normalized)) {
    throw new Error(
      "UPLOAD_DIR is outside allowed directories (set UPLOAD_ALLOWED_ROOT for custom absolute paths)"
    );
  }
  return normalized;
}

/** 本地上传根目录，默认 public/uploads，Docker 可通过 UPLOAD_DIR 挂载卷 */
export function getUploadRoot(): string {
  return resolveUploadRoot();
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