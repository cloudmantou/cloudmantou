import { NextRequest } from "next/server";
import { generateText } from "ai";
import { fail, ok } from "@/lib/api-response";
import { AiConfigurationError } from "@/lib/ai/config";
import { createAiTextModel } from "@/lib/ai/provider";
import { resolveAiTestConfig } from "@/lib/ai/settings-service";
import { aiSettingsInputSchema } from "@/lib/ai/settings-schema";
import { ApiError, requireAdminAndAudit } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const runtime = "nodejs";

const TEST_RATE_LIMIT = {
  limit: 8,
  windowMs: 10 * 60 * 1000,
  scope: "admin-ai-settings-test",
} as const;
const TEST_BODY_LIMIT_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "settings.ai.test");
    const rateLimited = await checkRateLimit(req, TEST_RATE_LIMIT, session.user.id);
    if (rateLimited) return rateLimited;

    const rawBody = await readRequestBodyWithLimit(req, TEST_BODY_LIMIT_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("请求内容格式错误", 42200, 422);
    }
    const parsed = aiSettingsInputSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || "AI 设置格式错误", 42200, 422);
    }

    const startedAt = Date.now();
    const { model, config } = createAiTextModel(await resolveAiTestConfig(parsed.data));
    const result = await generateText({
      model,
      prompt: "Reply with exactly: OK",
      temperature: 0,
      maxOutputTokens: 8,
      maxRetries: 0,
      timeout: Math.min(config.requestTimeoutMs, 30_000),
    });

    if (!result.text.trim()) return fail("模型返回了空内容", 50210, 502);
    return ok({
      connected: true,
      provider: config.providerName,
      model: config.textModel,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    if (error instanceof RequestBodyTooLargeError) return fail("请求内容过大", 41300, 413);
    if (error instanceof AiConfigurationError) {
      return fail(error.code === "AI_INVALID_CONFIG" ? "AI 设置无效" : "AI 服务尚未配置", 50310, 503);
    }
    console.error("[Admin AI Settings Test Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("模型连接测试失败", 50210, 502);
  }
}
