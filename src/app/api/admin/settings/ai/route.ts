import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { auditAdminAction } from "@/lib/admin-audit-log";
import { ApiError, requireAdmin } from "@/lib/guards";
import {
  getAdminAiSettings,
  saveAdminAiSettings,
} from "@/lib/ai/settings-service";
import { aiSettingsInputSchema } from "@/lib/ai/settings-schema";
import { AiConfigurationError } from "@/lib/ai/config";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const runtime = "nodejs";

const SETTINGS_BODY_LIMIT_BYTES = 16 * 1024;

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getAdminAiSettings());
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Admin AI Settings GET Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("获取 AI 设置失败", 50000, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const rawBody = await readRequestBodyWithLimit(req, SETTINGS_BODY_LIMIT_BYTES);
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

    await saveAdminAiSettings(parsed.data);
    await auditAdminAction(req, session.user.id, "settings.ai.update", {
      detail: [
        `mode=${parsed.data.mode}`,
        `provider=${parsed.data.providerName}`,
        `model=${parsed.data.textModel}`,
        parsed.data.apiKey ? "apiKey=rotated" : "apiKey=unchanged",
      ].join(","),
    });
    return ok({ saved: true });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    if (error instanceof RequestBodyTooLargeError) return fail("请求内容过大", 41300, 413);
    if (error instanceof AiConfigurationError) {
      return fail(error.code === "AI_NOT_CONFIGURED" ? "请先填写 API Key" : "AI 设置无效", 42200, 422);
    }
    console.error("[Admin AI Settings PUT Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("保存 AI 设置失败", 50000, 500);
  }
}
