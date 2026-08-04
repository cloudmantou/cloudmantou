import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { ApiError, requireAdminAndAudit } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { importRemoteImages } from "@/lib/remote-image";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const runtime = "nodejs";

const REMOTE_IMAGE_BODY_LIMIT_BYTES = 8 * 1024;
const REMOTE_IMAGE_IMPORT_RATE_LIMIT = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
  scope: "admin-image-import",
} as const;

const importSchema = z
  .object({
    urls: z.array(z.string().trim().min(1).max(4096)).min(1).max(20),
    purpose: z.enum(["content", "cover"]).default("content"),
  })
  .transform((value) => ({ ...value, urls: [...new Set(value.urls)] }))
  .refine((value) => value.urls.length <= 10, {
    path: ["urls"],
    message: "单次最多导入 10 张图片",
  });

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "image.remote-import");
    const rawBody = await readRequestBodyWithLimit(req, REMOTE_IMAGE_BODY_LIMIT_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("请求内容格式错误", 42200, 422);
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || "图片地址格式错误", 42200, 422);
    }

    for (const _url of parsed.data.urls) {
      const rateLimited = await checkRateLimit(
        req,
        REMOTE_IMAGE_IMPORT_RATE_LIMIT,
        session.user.id
      );
      if (rateLimited) return rateLimited;
    }

    const result = await importRemoteImages(parsed.data.urls, {
      purpose: parsed.data.purpose,
      signal: req.signal,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    if (error instanceof RequestBodyTooLargeError) {
      return fail("请求内容过大", 41300, 413);
    }
    console.error(
      "[Remote Image Import Error]",
      error instanceof Error ? error.name : "UnknownError"
    );
    return fail("远程图片导入失败", 50000, 500);
  }
}
