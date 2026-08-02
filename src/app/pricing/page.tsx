import type { Metadata } from "next";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { PricingPageClient } from "@/components/official/PricingPageClient";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { getOfficialMessages } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.pricing;
  const ctx = withEditorialSeoContext(await getSeoContext(locale));
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/pricing",
  });
}

export default async function PricingPage() {
  const locale = await getRequestLocale();
  return (
    <EditorialShell locale={locale}>
      <PricingPageClient />
    </EditorialShell>
  );
}
