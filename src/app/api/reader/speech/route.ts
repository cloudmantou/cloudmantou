import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/guards";
import { readerSpeechVoices } from "@/lib/reader-speech/config";
import { readerSpeechErrorResponse } from "@/lib/reader-speech/http";
import { getReaderSpeechSettings } from "@/lib/reader-speech/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth();
    const settings = await getReaderSpeechSettings();
    const response = ok(settings.map((item) => ({
      service: item.service,
      available: item.enabled && item.keyConfigured,
      model: item.model,
      ...(item.service === "tts" ? { voice: item.voice, voices: readerSpeechVoices(item) } : {}),
    })));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return readerSpeechErrorResponse(error);
  }
}
