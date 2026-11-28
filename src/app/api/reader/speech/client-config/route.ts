import { fail, ok } from "@/lib/api-response";
import { hasJsonContentType } from "@/lib/csrf-origin";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { appAttestRequest, verifyConfigClient } from "@/lib/reader-speech/client-attestation";
import { parseSpeechRequest, readerSpeechErrorResponse } from "@/lib/reader-speech/http";
import { getOfficialMiMoAccess, officialMiMoCatalog } from "@/lib/reader-speech/website-config";

export const runtime = "nodejs";

export function GET() {
  const response = ok(officialMiMoCatalog());
  response.headers.set("Cache-Control", "public, max-age=60");
  return response;
}

export async function POST(req: Request) {
  if (!hasJsonContentType(req)) return fail("请求格式不正确", 41500, 415);
  try {
    const limited = await checkRateLimit(req, { scope: "mtsk-speech-config", limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const input = await parseSpeechRequest(req, appAttestRequest, 16_384);
    await verifyConfigClient(input);
    const response = ok(getOfficialMiMoAccess());
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
