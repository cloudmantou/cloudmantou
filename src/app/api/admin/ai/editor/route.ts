import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { AiConfigurationError } from "@/lib/ai/config";
import {
  AiGenerationError,
  generateEditorialSuggestion,
} from "@/lib/ai/editor-service";
import { editorAiInputSchema } from "@/lib/ai/editor-types";
import { ApiError, requireAdminAndAudit } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const runtime = "nodejs";

const EDITOR_AI_BODY_LIMIT_BYTES = 128 * 1024;
const EDITOR_AI_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
  scope: "admin-ai-editor",
} as const;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "ai.editor.generate");
    const rateLimited = await checkRateLimit(
      req,
      EDITOR_AI_RATE_LIMIT,
      session.user.id,
    );
    if (rateLimited) return rateLimited;

    const rawBody = await readRequestBodyWithLimit(req, EDITOR_AI_BODY_LIMIT_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("请求内容格式错误", 42200, 422);
    }

    const parsed = editorAiInputSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || "AI 请求参数错误", 42200, 422);
    }

    const result = await generateEditorialSuggestion(parsed.data, {
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
    if (error instanceof AiConfigurationError) {
      const message = error.code === "AI_INVALID_CONFIG"
        ? "AI 服务配置无效"
        : "AI 服务尚未配置";
      return fail(message, 50310, 503);
    }
    if (error instanceof AiGenerationError) {
      return fail(
        error.code === "AI_INVALID_OUTPUT" ? "AI 返回内容格式错误" : "AI 内容生成失败",
        50210,
        502,
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      return fail("AI 请求已取消", 49900, 499);
    }
    console.error("[Editorial AI Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("AI 内容生成失败", 50000, 500);
  }
}
