import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { requireAdminAndAudit } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit-server";
import { parseSpeechRequest, readerSpeechErrorResponse } from "@/lib/reader-speech/http";
import { suggestReaderRoles, synthesizeReaderSpeech } from "@/lib/reader-speech/upstream";
import { readerSpeechSettingsInput, resolveReaderSpeechTest } from "@/lib/reader-speech/settings";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminAndAudit(req, "settings.reader-speech.test");
    const limited = await checkRateLimit(req, { scope: "reader-speech-admin-test", limit: 8, windowMs: 600_000 }, session.user.id);
    if (limited) return limited;

    const input = await parseSpeechRequest(req, readerSpeechSettingsInput, 16 * 1_024);
    const config = await resolveReaderSpeechTest(input);
    const startedAt = Date.now();
    if (config.service === "roles") {
      await suggestReaderRoles(config, {
        chapter: "范進道：「童生就是。」",
        dialogues: [{ id: 0, text: "「童生就是。」" }],
        knownSpeakers: ["范進"],
      }, req.signal);
    } else {
      await synthesizeReaderSpeech(config, { text: "欢迎使用红笺墨语。" }, req.signal);
    }
    return ok({ connected: true, service: config.service, model: config.model, latencyMs: Date.now() - startedAt });
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
