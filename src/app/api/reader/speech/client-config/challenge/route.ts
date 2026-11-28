import { ok } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { createConfigChallenge } from "@/lib/reader-speech/client-attestation";
import { readerSpeechErrorResponse } from "@/lib/reader-speech/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = await checkRateLimit(req, { scope: "mtsk-speech-config-challenge", limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const response = ok({ challenge: createConfigChallenge() });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
