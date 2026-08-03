import type { Metadata } from "next";
import { EditorialPublicInfoPage } from "@/components/editorial/EditorialPublicInfoPage";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { getEditorialPublicInfo } from "@/config/editorial-blog";
import { getRequestLocale } from "@/i18n/server";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const [baseCtx, copy] = await Promise.all([getSeoContext(locale), Promise.resolve(getEditorialPublicInfo(locale, "about"))]);
  return buildPageMetadata(withEditorialSeoContext(baseCtx), { title: copy.title, description: copy.description, path: "/about" });
}

export default async function AboutPage() {
  const locale = await getRequestLocale();
  return <EditorialShell locale={locale}><EditorialPublicInfoPage locale={locale} page="about" /></EditorialShell>;
}
