import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import type { ReaderSpeechSettings } from "@/lib/reader-speech/config";
import { parseSpeechRequest, readerSpeechErrorResponse } from "@/lib/reader-speech/http";
import { rolesInput, speechInput, suggestReaderRoles, synthesizeReaderSpeech } from "@/lib/reader-speech/mimo";
import { resolveReaderSpeechService } from "@/lib/reader-speech/settings";

export const runtime = "nodejs";

async function checkSpeechLimits(req: NextRequest, service: ReaderSpeechSettings, userId: string) {
  const scope = "reader-speech-" + service.service;
  const userLimit = await checkRateLimit(req, {
    scope,
    limit: service.service === "roles" ? 4 : 60,
    windowMs: 60_000,
  }, userId);
  if (userLimit) return userLimit;
  return checkRateLimit(req, { scope: scope + "-daily", limit: service.dailyLimit, windowMs: 86_400_000 }, "site-wide");
}

export async function POST(req: NextRequest, context: { params: Promise<{ service: string }> }) {
  try {
    const session = await requireAuth();
    const { service } = await context.params;
    if (service !== "roles" && service !== "tts") return fail("听书服务不存在", 40400, 404);

    const config = await resolveReaderSpeechService(service);
    if (config.service === "roles") {
      const input = await parseSpeechRequest(req, rolesInput, 224 * 1_024);
      const limit = await checkSpeechLimits(req, config, session.user.id);
      if (limit) return limit;
      const response = ok(await suggestReaderRoles(config, input, req.signal));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const input = await parseSpeechRequest(req, speechInput, 28 * 1_024);
    const limit = await checkSpeechLimits(req, config, session.user.id);
    if (limit) return limit;
    const audio = await synthesizeReaderSpeech(config, input, req.signal);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
