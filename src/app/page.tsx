import type { Metadata } from "next";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { OfficialHome } from "@/components/official/OfficialHome";
import { isOfficialSite } from "@/config/site";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: `${ctx.name} — ${ctx.subtitle}`,
    description: ctx.description,
    path: "/",
  });
}

export default function HomePage() {
  if (isOfficialSite) {
    return <OfficialHome />;
  }
  return <PlatformShell />;
}
