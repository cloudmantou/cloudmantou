import type { NextRequest } from "next/server";
import { requireAuth, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { feedbackInclude, feedbackPage, feedbackPolicy, pointReceipt } from "@/lib/feedback-server";
import { privateOk, feedbackFail } from "@/lib/feedback-request";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(); const userId = session.user.id; const page = feedbackPage(req);
    const [user, ledger, redemptions, feedbacks, policy, total] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
      prisma.pointEntry.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
      prisma.pointRedemption.findMany({ where: { userId }, include: { reward: { include: { package: true } }, order: { include: { delivery: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.articleFeedback.findMany({ where: { userId }, include: feedbackInclude, orderBy: { createdAt: "desc" }, take: 30 }), feedbackPolicy(), prisma.pointEntry.count({ where: { userId } }),
    ]);
    if (!user) throw new ApiError("用户不存在", 40400, 404);
    return privateOk({ points: user.points, ledger, redemptions: redemptions.map(r => ({ ...pointReceipt(r), name: r.reward.package.name, note: r.reward.package.redemptionNote })), feedbacks, policy, page, hasMore: page * 20 < total });
  } catch (e) { return feedbackFail(e); }
}
