import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, ApiError } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { redeemPointReward, pointReceipt } from "@/lib/feedback-server";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
const schema = z.object({ rewardId: z.string().cuid(), requestKey: z.string().uuid() }).strict();
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const limit = await checkRateLimit(req, { limit: 10, windowMs: 60000, scope: "points-redeem" }, session.user.id); if (limit) return limit;
    const parsed = schema.safeParse(await feedbackJson(req));
    if (!parsed.success) throw new ApiError("兑换请求不正确", 42200, 422);
    return privateOk(pointReceipt(await redeemPointReward(session.user.id, parsed.data.rewardId, parsed.data.requestKey)));
  } catch (e) { return feedbackFail(e); }
}
