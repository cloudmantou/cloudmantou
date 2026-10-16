import { NextRequest } from "next/server";
import { unlink } from "node:fs/promises";
import { requireAdminAndAudit, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { IPA_MAX_BYTES, serializeArticleIpa } from "@/lib/article-ipa";
import { saveAndInspectIpa, ipaStoragePath } from "@/lib/article-ipa-server";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "upload.article-ipa");
    if (Number(req.headers.get("content-length")) > IPA_MAX_BYTES + 1024 * 1024) return fail("安装包不能超过 200 MB", 41300, 413);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("请选择 IPA 文件", 42200, 422);
    const data = await saveAndInspectIpa(file);
    try {
      const release = await prisma.articleIpaRelease.create({ data: { ...data, uploadedBy: session.user.id } });
      return ok(serializeArticleIpa(release));
    } catch (error) {
      await unlink(ipaStoragePath(data.storageKey)).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Article IPA Upload]", error);
    return fail("安装包上传失败，请稍后重试", 50000, 500);
  }
}
