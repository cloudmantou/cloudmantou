import type { Metadata } from "next";
import { OfficialShell } from "@/components/official/OfficialShell";
import { PricingPageClient } from "@/components/official/PricingPageClient";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.pricing;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/pricing",
  });
}

export default function PricingPage() {
  return (
    <OfficialShell>
      <PricingPageClient />
    </OfficialShell>
  );
}
