import type { NextRequest } from "next/server";
import { requireAdminAndAudit, ApiError } from "@/lib/guards";
import { feedbackUpdateSchema } from "@/lib/feedback";
import { updateFeedback } from "@/lib/feedback-server";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const session = await requireAdminAndAudit(req, "feedback.update", { targetType: "feedback", targetId: id });
    const parsed = feedbackUpdateSchema.safeParse(await feedbackJson(req));
    if (!parsed.success) throw new ApiError(parsed.error.errors[0].message, 42200, 422);
    return privateOk(await updateFeedback(id, session.user.id, parsed.data));
  } catch (e) { return feedbackFail(e); }
}
