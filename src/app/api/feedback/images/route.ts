import type { NextRequest } from "next/server";
import { requireAuth, ApiError } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { feedbackMutationOrigin, privateOk, feedbackFail } from "@/lib/feedback-request";
import { FEEDBACK_IMAGE_LIMIT, uploadFeedbackImage } from "@/lib/feedback-images";
import { ImageProcessError } from "@/lib/image-process-server";
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(); feedbackMutationOrigin(req);
    const limited = await checkRateLimit(req, { limit: 15, windowMs: 3600000, scope: "feedback-image" }, session.user.id); if (limited) return limited;
    const cap = FEEDBACK_IMAGE_LIMIT + 65536;
    if (Number(req.headers.get("content-length")) > cap) throw new ApiError("截图不能超过 4 MB", 41300, 413);
    const reader = req.body?.getReader(); if (!reader) throw new ApiError("请选择截图", 42200, 422);
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > cap) { await reader.cancel(); throw new ApiError("截图不能超过 4 MB", 41300, 413); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    const body = Buffer.concat(chunks);
    const form = await new Response(body, { headers: { "Content-Type": req.headers.get("content-type") || "" } }).formData();
    const file = form.get("file"); if (!(file instanceof File)) throw new ApiError("请选择截图", 42200, 422);
    return privateOk(await uploadFeedbackImage(session.user.id, Buffer.from(await file.arrayBuffer())));
  } catch (e) { return feedbackFail(e instanceof ImageProcessError ? new ApiError(e.message, 42200, 422) : e); }
}
