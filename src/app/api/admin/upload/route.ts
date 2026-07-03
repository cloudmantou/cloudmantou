import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAdmin, ApiError } from "@/lib/guards";
import { ok, fail } from "@/lib/api-response";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return fail("请选择图片文件", 40000, 400);
    }

    if (!ALLOWED.has(file.type)) {
      return fail("仅支持 JPG / PNG / WebP / GIF", 40000, 400);
    }

    if (file.size > MAX_BYTES) {
      return fail("图片不能超过 5MB", 40000, 400);
    }

    const ext =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : file.type === "image/gif"
            ? "gif"
            : "webp";

    const now = new Date();
    const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    return ok({ url: `/uploads/${folder}/${filename}` });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Upload Error]", error);
    return fail("图片上传失败", 50000, 500);
  }
}