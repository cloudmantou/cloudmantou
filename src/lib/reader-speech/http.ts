import { z, ZodError } from "zod";
import { fail } from "@/lib/api-response";
import { ApiError } from "@/lib/api-error";
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from "@/lib/request-body";

export async function parseSpeechRequest<T>(
  req: Request,
  schema: z.ZodType<T>,
  limitBytes: number,
): Promise<T> {
  const text = await readRequestBodyWithLimit(req, limitBytes);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError("请求内容格式错误", 42200, 422);
  }
  return schema.parse(value);
}

export function readerSpeechErrorResponse(error: unknown) {
  if (error instanceof ApiError) return fail(error.message, error.code, error.status);
  if (error instanceof RequestBodyTooLargeError) return fail("请求内容过大", 41300, 413);
  if (error instanceof ZodError) return fail(error.issues[0]?.message || "听书请求无效", 42200, 422);
  console.error("[Reader speech]", error instanceof Error ? error.name : "UnknownError");
  return fail("听书服务请求失败", 50000, 500);
}
