import type { NextRequest } from "next/server";
import { auditAdminAction } from "@/lib/admin-audit-log";
import { ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guards";
import { parseSpeechRequest, readerSpeechErrorResponse } from "@/lib/reader-speech/http";
import { getReaderSpeechSettings, readerSpeechSettingsInput, saveReaderSpeechSettings } from "@/lib/reader-speech/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const response = ok(await getReaderSpeechSettings());
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const input = await parseSpeechRequest(req, readerSpeechSettingsInput, 16 * 1_024);
    const saved = await saveReaderSpeechSettings(input);
    await auditAdminAction(req, session.user.id, "settings.reader-speech.update", {
      targetId: input.service,
      detail: input.clearApiKey ? "apiKey=cleared" : input.apiKey ? "apiKey=rotated" : "apiKey=unchanged",
    });
    return ok(saved);
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
