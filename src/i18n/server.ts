import "server-only";
import { headers } from "next/headers";
import { isOfficialLocale, resolveOfficialLocale, type OfficialLocale } from "@/i18n/official";

export async function getRequestLocale(): Promise<OfficialLocale> {
  const requestHeaders = await headers();
  const routedLocale = requestHeaders.get("x-official-locale");
  if (isOfficialLocale(routedLocale)) return routedLocale;
  return resolveOfficialLocale({
    cookieHeader: requestHeaders.get("cookie"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}
