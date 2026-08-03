import type { Metadata } from "next";
import Link from "next/link";
import { Download, Laptop, Monitor } from "lucide-react";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialPublicHero, EditorialPublicSection } from "@/components/editorial/EditorialPublicPage";
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
  const [downloadUrls, ctx, nonce] = await Promise.all([
    getSiteSettings()
      .then((settings) => getDesktopDownloadUrls(settings))
      .catch(() => getDesktopDownloadUrls()),
    getSeoContext(locale),
    getCspNonce(),
  ]);
  const copy = getOfficialMessages(locale).pages.download;
  const configuredDownloads = new Map(downloadUrls.map((item) => [item.id, item.url]));
  const hasConfiguredDownload = downloadUrls.some((item) => item.url !== null);

  return (
    <EditorialShell locale={locale}>
      <JsonLd
        ctx={ctx}
        nonce={nonce}
        variant="extra"
        extra={[buildSoftwareApplicationJsonLd(ctx)]}
      />
      <EditorialPublicHero
        eyebrow={locale === "en" ? "GET THE DESKTOP CLIENT" : "获取电脑端工具"}
        title={copy.pageTitle}
        description={copy.description}
      />
      <EditorialPublicSection title={copy.platformTitle} description={copy.platformDescription}>
          <div className="editorial-public-card-grid editorial-download-grid">
            {copy.platforms.map((platform) => {
              const downloadUrl = configuredDownloads.get(platform.id);
              const PlatformIcon = platform.id === "windows" ? Monitor : Laptop;

              return (
                <article key={platform.id} className="editorial-public-card editorial-download-card">
                  <span className="editorial-public-card-icon" aria-hidden="true">
                    <PlatformIcon size={30} />
                  </span>
                  <div>
                    <h3>{platform.name}</h3>
                    <p>{platform.description}</p>
                  </div>
                  {downloadUrl ? (
                    <a href={downloadUrl} className="editorial-button editorial-button-blue">
                      <Download size={17} aria-hidden="true" />
                      {platform.action}
                    </a>
                  ) : (
                    <span className="editorial-download-pending" aria-disabled="true">
                      {platform.pending}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
      </EditorialPublicSection>
      <EditorialPublicSection title={copy.requirementsTitle}>
        <ul className="editorial-public-checklist">
          {copy.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </EditorialPublicSection>
      <EditorialPublicSection title={copy.packageTitle}>
        {!hasConfiguredDownload ? <p>{copy.packageUnavailable}</p> : null}
        <p>{copy.freeNotice}</p>
        <div className="editorial-public-actions">
          <Link href={localizeOfficialPath("/docs", locale)} className="editorial-button editorial-button-blue">
            {copy.docsAction}
          </Link>
        </div>
      </EditorialPublicSection>
    </EditorialShell>
  );
}
