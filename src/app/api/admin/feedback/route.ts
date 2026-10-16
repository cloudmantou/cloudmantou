import type { NextRequest } from "next/server";
import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { feedbackPolicySchema, feedbackStatuses } from "@/lib/feedback";
import { feedbackInclude, feedbackPolicy, feedbackPage } from "@/lib/feedback-server";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const page = feedbackPage(req); const status = req.nextUrl.searchParams.get("status");
    if (status && !feedbackStatuses.includes(status as typeof feedbackStatuses[number])) throw new ApiError("状态不正确", 42200, 422);
    const where = status ? { status: status as typeof feedbackStatuses[number] } : {};
    const [items, total, policy] = await Promise.all([prisma.articleFeedback.findMany({ where, include: feedbackInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }), prisma.articleFeedback.count({ where }), feedbackPolicy()]);
    return privateOk({ items, page, total, hasMore: page * 20 < total, policy });
  } catch (e) { return feedbackFail(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    const parsed = feedbackPolicySchema.safeParse(await feedbackJson(req));
    if (!parsed.success) throw new ApiError("奖励积分须为 0–10000 的整数", 42200, 422);
    await requireAdminAndAudit(req, "feedback.policy.update");
    await prisma.siteSetting.upsert({ where: { key: "feedback.pointsPolicy" }, create: { key: "feedback.pointsPolicy", value: JSON.stringify(parsed.data), type: "json" }, update: { value: JSON.stringify(parsed.data) } });
    return privateOk(parsed.data);
  } catch (e) { return feedbackFail(e); }
}
