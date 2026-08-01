import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileKey2, History, MapPin, RefreshCcw, WifiOff } from "lucide-react";
import { OfficialShell } from "@/components/official/OfficialShell";
import { PageHeader } from "@/components/official/sections";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages, localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.features;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/features",
  });
}

const DETAIL_ICONS = [History, MapPin, FileKey2, WifiOff, RefreshCcw, BookOpen] as const;

export default async function FeaturesPage() {
  const locale = await getRequestLocale();
  const messages = getOfficialMessages(locale);
  const copy = messages.pages.features;
  return (
    <OfficialShell>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <div className="official-container official-feature-grid" style={{ paddingBottom: 32 }}>
        {messages.home.features.map((item, index) => {
          const Icon = DETAIL_ICONS[index];
          return (
            <article key={item.title} className="official-feature-card">
              <div
                className="official-feature-icon"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          );
        })}
      </div>
      <div className="official-container" style={{ paddingBottom: 56 }}>
        <Link href={localizeOfficialPath("/download", locale)} className="official-btn official-btn-primary">
          {copy.action}
        </Link>
      </div>
    </OfficialShell>
  );
}
