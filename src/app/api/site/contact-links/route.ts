import { getSiteSettings } from "@/lib/site-settings";
import { getPublicContactLinks } from "@/lib/contact-links";
import { ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  return ok(getPublicContactLinks(settings.contactLinks));
}