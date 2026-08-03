import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileKey2, History, MapPin, RefreshCcw, WifiOff } from "lucide-react";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialPublicHero, EditorialPublicSection } from "@/components/editorial/EditorialPublicPage";
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
    <EditorialShell locale={locale}>
      <EditorialPublicHero
        eyebrow={locale === "en" ? "CAPABILITIES / IOS 15+" : "核心能力 / iOS 15+"}
        title={copy.title}
        description={copy.description}
      />
      <EditorialPublicSection
        title={locale === "en" ? "Six practical tools" : "六项实用能力"}
        description={locale === "en" ? "Clear requirements, focused workflows, no exaggerated promises." : "明确系统要求，聚焦实际流程，不做夸张承诺。"}
      >
      <div className="editorial-public-card-grid editorial-public-feature-grid">
        {messages.home.features.map((item, index) => {
          const Icon = DETAIL_ICONS[index];
          return (
            <article key={item.title} className={`editorial-public-card accent-${index % 3}`}>
              <div className="editorial-public-card-icon">
                <Icon size={20} aria-hidden="true" />
              </div>
              <span className="editorial-public-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          );
        })}
      </div>
      <div className="editorial-public-actions">
        <Link href={localizeOfficialPath("/download", locale)} className="editorial-button editorial-button-blue">
          {copy.action}
        </Link>
      </div>
      </EditorialPublicSection>
    </EditorialShell>
  );
}
