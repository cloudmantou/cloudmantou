import { NextRequest } from "next/server";
import { requireAdmin, ApiError } from "@/lib/guards";
import { auditAdminActionStrict } from "@/lib/admin-audit-log";
import { hasJsonContentType, isAllowedMutationOrigin } from "@/lib/csrf-origin";
const headers = { "Cache-Control": "private, no-store" };
const messages: Record<string, string> = { busy: "该地区有下载任务，请完成后重试", recovery_busy: "恢复正在执行或处于一分钟操作冷却期", authentication_unavailable: "认证仍在冷却，请等待后台显示的时间", auth_code_required: "账号需要验证码，请由管理员完成安全登录后再恢复", invalid_credentials: "账号凭证失效，请管理员更新受保护的账号凭证", account_disabled: "账号已停用，需要处理 Apple 账号", authentication_locked: "认证已锁定，请完成管理员登录后再恢复" };
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!hasJsonContentType(req) || !isAllowedMutationOrigin(req)) return Response.json({ message: "请求来源无效" }, { status: 403, headers });
    const raw = await req.text(); if (raw.length > 1024) return Response.json({ message: "请求过大" }, { status: 413, headers });
    let body: unknown; try { body = JSON.parse(raw); } catch { return Response.json({ message: "请求无效" }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !("region" in body) || (body.region !== "cn" && body.region !== "us")) return Response.json({ message: "地区无效" }, { status: 422, headers });
    const region = body.region; const key = process.env.IPATOOL_OPERATOR_KEY;
    if (!key || key.length < 32) return Response.json({ message: "恢复入口尚未配置" }, { status: 503, headers });
    await auditAdminActionStrict(req, session.user.id, "assistant.recovery.request", { targetType: "ipatool", targetId: region });
    const response = await fetch(`http://127.0.0.1:${region === "cn" ? 18092 : 18091}/api/recover`, { method: "POST", headers: { authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(5000) });
    const payload = await response.json();
    if (response.status !== 202) return Response.json({ message: messages[payload.error?.code] || "恢复未受理，请检查服务连接和操作配置" }, { status: response.status === 409 ? 409 : 503, headers });
    return Response.json({ message: "已受理一次重新认证，请查看地区卡片中的恢复结果。", id: typeof payload.data?.id === "string" ? payload.data.id : undefined }, { status: 202, headers });
  } catch (e) { return Response.json({ message: e instanceof ApiError ? e.message : "无法确认恢复是否受理，请先刷新状态再操作" }, { status: e instanceof ApiError ? e.status : 503, headers }); }
}
