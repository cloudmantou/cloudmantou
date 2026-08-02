import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { OfficialI18nProvider } from "@/i18n/OfficialI18nProvider";
import { isOfficialSite } from "@/config/site";
import { getCspNonce } from "@/lib/csp-nonce";
import { getRequestLocale } from "@/i18n/server";
import { BLOG_KEYWORDS, buildRootMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import "./globals.css";
import "@/styles/cards.css";
import "@/styles/official.css";
import "@/styles/official-home.css";
import "@/styles/editorial-blog.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const ctx = withEditorialSeoContext(await getSeoContext(locale));
  return buildRootMetadata(ctx, { keywords: BLOG_KEYWORDS });
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const [baseCtx, nonce] = await Promise.all([getSeoContext(locale), getCspNonce()]);
  const ctx = withEditorialSeoContext(baseCtx);

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className={isOfficialSite ? "official-site-root" : undefined}>
      <body className={isOfficialSite ? "official-site-body" : undefined}>
        <JsonLd ctx={ctx} nonce={nonce} variant="editorial" />
        <OfficialI18nProvider locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </OfficialI18nProvider>
      </body>
    </html>
  );
}
