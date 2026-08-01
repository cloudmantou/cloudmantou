import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { OfficialI18nProvider } from "@/i18n/OfficialI18nProvider";
import { isOfficialSite } from "@/config/site";
import { getCspNonce } from "@/lib/csp-nonce";
import { getRequestLocale } from "@/i18n/server";
import { buildRootMetadata, getSeoContext } from "@/lib/seo";
import "./globals.css";
import "@/styles/cards.css";
import "@/styles/official.css";
import "@/styles/official-home.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const ctx = await getSeoContext(locale);
  return buildRootMetadata(ctx);
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const [ctx, nonce] = await Promise.all([getSeoContext(locale), getCspNonce()]);

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className={isOfficialSite ? "official-site-root" : undefined}>
      <body className={isOfficialSite ? "official-site-body" : undefined}>
        <JsonLd ctx={ctx} nonce={nonce} />
        <OfficialI18nProvider locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </OfficialI18nProvider>
      </body>
    </html>
  );
}
