import type { NextRequest } from "next/server";
import { isAllowedMutationOrigin } from "@/lib/csrf-origin";
import { ApiError } from "@/lib/guards";
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from "@/lib/request-body";
import { fail, ok } from "@/lib/api-response";
import { feedbackError } from "@/lib/feedback-server";
export function feedbackMutationOrigin(req: NextRequest) {
  if (!isAllowedMutationOrigin(req)) throw new ApiError("跨站请求被拒绝", 40300, 403);
}
export async function feedbackJson(req: NextRequest) {
  feedbackMutationOrigin(req);
  try { return JSON.parse(await readRequestBodyWithLimit(req, 32 * 1024)); }
  catch (e) { if (e instanceof RequestBodyTooLargeError) throw new ApiError("请求内容太大", 41300, 413); throw e; }
}
export function privateOk<T>(data: T) { const r = ok(data); r.headers.set("Cache-Control", "private, no-store"); return r; }
export function feedbackFail(error: unknown) { const e = feedbackError(error); return fail(e.message, e.code, e.status); }
