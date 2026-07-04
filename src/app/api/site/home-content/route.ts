import { getSiteSettings } from "@/lib/site-settings";
import { ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  return ok({
    siteName: settings.siteName,
    siteSubtitle: settings.siteSubtitle,
    siteDescription: settings.siteDescription,
    typingPhrases: settings.homeTypingPhrases,
  });
}