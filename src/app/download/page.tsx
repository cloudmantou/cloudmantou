import type { Metadata } from "next";
import Link from "next/link";
import { OfficialShell } from "@/components/official/OfficialShell";
import { InstallStepsSection, PageHeader } from "@/components/official/sections";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages, localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

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
  const copy = getOfficialMessages(locale).pages.download;
  return (
    <OfficialShell>
      <PageHeader
        title={copy.pageTitle}
        description={copy.description}
      />
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
        <p>{copy.packageUnavailable}</p>
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
