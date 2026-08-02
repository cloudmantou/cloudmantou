import type { Metadata } from "next";
import Link from "next/link";
import { Download, Laptop, Monitor } from "lucide-react";
import { OfficialShell } from "@/components/official/OfficialShell";
import { InstallStepsSection, PageHeader } from "@/components/official/sections";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages, localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";
import { getDesktopDownloadUrls } from "@/lib/desktop-downloads";
import { getSiteSettings } from "@/lib/site-settings";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildSoftwareApplicationJsonLd } from "@/lib/seo";
import { getCspNonce } from "@/lib/csp-nonce";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.download;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/download",
  });
}

export default async function DownloadPage() {
  const locale = await getRequestLocale();
  const [siteSettings, ctx, nonce] = await Promise.all([
    getSiteSettings(),
    getSeoContext(locale),
    getCspNonce(),
  ]);
  const copy = getOfficialMessages(locale).pages.download;
  const downloadUrls = getDesktopDownloadUrls(siteSettings);
  const configuredDownloads = new Map(downloadUrls.map((item) => [item.id, item.url]));
  const hasConfiguredDownload = downloadUrls.some((item) => item.url !== null);

  return (
    <OfficialShell>
      <JsonLd
        ctx={ctx}
        nonce={nonce}
        variant="extra"
        extra={[buildSoftwareApplicationJsonLd(ctx)]}
      />
      <PageHeader
        title={copy.pageTitle}
        description={copy.description}
      />
      <section className="official-download-platforms" aria-labelledby="desktop-platform-title">
        <div className="official-container">
          <div className="official-download-platform-heading">
            <h2 id="desktop-platform-title">{copy.platformTitle}</h2>
            <p>{copy.platformDescription}</p>
          </div>
          <div className="official-download-platform-grid">
            {copy.platforms.map((platform) => {
              const downloadUrl = configuredDownloads.get(platform.id);
              const PlatformIcon = platform.id === "windows" ? Monitor : Laptop;

              return (
                <article key={platform.id} className="official-download-platform-card">
                  <span className="official-download-platform-icon" aria-hidden="true">
                    <PlatformIcon size={30} />
                  </span>
                  <div>
                    <h3>{platform.name}</h3>
                    <p>{platform.description}</p>
                  </div>
                  {downloadUrl ? (
                    <a href={downloadUrl} className="official-btn official-btn-primary">
                      <Download size={17} aria-hidden="true" />
                      {platform.action}
                    </a>
                  ) : (
                    <span className="official-download-pending" aria-disabled="true">
                      {platform.pending}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <div className="official-container" style={{ paddingBottom: 24 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>{copy.requirementsTitle}</h2>
        <ul className="official-prose">
          {copy.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <InstallStepsSection />
      <div className="official-container official-prose" style={{ paddingBottom: 56 }}>
        <h2>{copy.packageTitle}</h2>
        {!hasConfiguredDownload ? <p>{copy.packageUnavailable}</p> : null}
        <p>{copy.freeNotice}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link href={localizeOfficialPath("/store", locale)} className="official-btn official-btn-primary">
            {copy.storeAction}
          </Link>
          <Link href={localizeOfficialPath("/docs", locale)} className="official-btn official-btn-ghost">
            {copy.docsAction}
          </Link>
        </div>
      </div>
    </OfficialShell>
  );
}
