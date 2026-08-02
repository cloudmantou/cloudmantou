"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  FileKey2,
  History,
  MapPin,
  RefreshCcw,
  Smartphone,
  Store,
  WifiOff,
} from "lucide-react";
import { ProductWorkspaceVisual } from "@/components/official/ProductWorkspaceVisual";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";
import type { StoreAppPublic } from "@/lib/store-apps";

const FEATURE_ICONS = {
  downgrade: History,
  location: MapPin,
  signing: FileKey2,
  "no-wifi": WifiOff,
  "latest-ios": RefreshCcw,
  xiangse: BookOpen,
} as const;

const APP_ICON_COLORS = ["#ff5f72", "#20b486", "#1769ff", "#6d55e8"] as const;

function appIconStyle(index: number) {
  return { background: APP_ICON_COLORS[index % APP_ICON_COLORS.length] };
}

export function HeroSection() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.home;
  return (
    <section className="official-home-hero" aria-labelledby="official-hero-title">
      <div className="official-container official-home-hero-grid">
        <div className="official-home-hero-copy fade-up">
          <div className="official-home-eyebrow">
            <span aria-hidden="true" /> {copy.eyebrow}
          </div>
          <h1 id="official-hero-title">{copy.hero.title}</h1>
          <p>{copy.hero.description}</p>
          <div className="official-home-actions">
            <Link href={localizeOfficialPath(copy.hero.primaryAction.href, locale)} className="official-btn official-btn-primary">
              <Download size={17} aria-hidden="true" />
              {copy.hero.primaryAction.label}
            </Link>
            <Link href={localizeOfficialPath(copy.hero.secondaryAction.href, locale)} className="official-btn official-btn-ghost">
              <FileKey2 size={17} aria-hidden="true" />
              {copy.hero.secondaryAction.label}
            </Link>
          </div>
          <div className="official-latest-note">
            <CheckCircle2 size={17} aria-hidden="true" />
            {copy.latestPrefix} <strong>{copy.latestVersion}</strong>
          </div>
        </div>
        <ProductWorkspaceVisual />
      </div>
    </section>
  );
}

export function CompatibilityStrip() {
  const { messages } = useOfficialI18n();
  const compatibility = messages.home.compatibility;
  const items = [
    { value: compatibility.baseline, label: compatibility.labels[0] },
    { value: compatibility.virtualLocation, label: compatibility.labels[1] },
    { value: compatibility.latest, label: compatibility.labels[2] },
    { value: compatibility.devices, label: compatibility.labels[3] },
  ] as const;

  return (
    <section className="official-compatibility" aria-label={compatibility.title}>
      <div className="official-container official-compatibility-grid">
        <div className="official-compatibility-title">
          <strong>{compatibility.title}</strong>
          <span>{compatibility.subtitle}</span>
        </div>
        {items.map((item) => (
          <div key={item.label} className="official-compatibility-item">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeatureGridSection() {
  const { messages } = useOfficialI18n();
  return (
    <section className="official-section official-capabilities" id="features">
      <div className="official-container">
        <div className="official-capability-grid">
          {messages.home.features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id];
            return (
              <article key={feature.id} className="official-capability-item fade-up">
                <span className={`official-capability-icon is-${feature.id}`}><Icon size={22} /></span>
                <h2>{feature.title}</h2>
                <p>{feature.meta}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function InstallStepsSection() {
  const { messages } = useOfficialI18n();
  const workflow = messages.home.workflow;
  return (
    <section className="official-section official-workflow">
      <div className="official-container">
        <div className="official-section-head official-section-head-center fade-up">
          <span className="official-section-index">{workflow.index}</span>
          <h2>{workflow.title}</h2>
          <p>{workflow.description}</p>
        </div>
        <div className="official-workflow-grid">
          {workflow.steps.map((step, index) => (
            <article key={step.title} className="official-workflow-step fade-up">
              <span className="official-workflow-number">{index + 1}</span>
              <span className="official-workflow-icon">
                {index === 0 ? <Smartphone /> : index === 1 ? <Store /> : <CheckCircle2 />}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {index < workflow.steps.length - 1 ? <ArrowRight className="official-workflow-arrow" /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function XiangseInstallSection() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.home.xiangse;
  return (
    <section className="official-section official-xiangse">
      <div className="official-container official-xiangse-panel fade-up">
        <div className="official-xiangse-copy">
          <span className="official-xiangse-icon">香</span>
          <div>
            <span className="official-section-index">{copy.index}</span>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
            <Link href={localizeOfficialPath("/store", locale)} className="official-btn official-btn-coral">
              {copy.action} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <ol className="official-xiangse-steps">
          {copy.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
              {index < copy.steps.length - 1 ? <ArrowRight aria-hidden="true" /> : <Check aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AppShowcaseSection({ apps }: { apps: StoreAppPublic[] }) {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.home.store;
  const filters = messages.pages.store.filters;
  const featured = apps.filter((app) => app.featured).slice(0, 4);
  const list = featured.length > 0 ? featured : apps.slice(0, 4);
  if (list.length === 0) return null;

  return (
    <section className="official-section official-store-preview">
      <div className="official-container">
        <div className="official-section-head fade-up">
          <span className="official-section-index">{copy.index}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          <Link href={localizeOfficialPath("/store", locale)} className="official-section-link">{copy.action} <ArrowRight size={15} /></Link>
        </div>
        <div className="official-app-scroll">
          {list.map((app, index) => (
            <Link key={app.id} href={localizeOfficialPath(`/store/${app.slug}`, locale)} className="official-app-card fade-up">
              <div className="official-app-icon" style={appIconStyle(index)}>{app.name.slice(0, 1)}</div>
              <div><h3>{app.name}</h3><p>{app.tagline || app.description.slice(0, 42)}</p></div>
              <span className="official-tag">{{ READING: filters.reading, TOOL: filters.tool, ENTERTAINMENT: filters.entertainment, OTHER: filters.other }[app.category]}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.home.faq;
  return (
    <section className="official-section official-home-faq">
      <div className="official-container official-faq-layout">
        <div className="official-section-head fade-up">
          <span className="official-section-index">{copy.index}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          <Link href={localizeOfficialPath("/docs", locale)} className="official-section-link">{copy.action} <ArrowRight size={15} /></Link>
        </div>
        <div className="official-faq">
          {copy.items.map((item) => (
            <details key={item.q} className="fade-up">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalDownloadSection() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.home;
  return (
    <section className="official-section official-final-download">
      <div className="official-container official-final-download-panel fade-up">
        <div>
          <span className="official-final-mark">
            <Image src="/brand/mantou-assistant-icon.png" alt="" width={58} height={58} />
          </span>
          <span><strong>{copy.final.title}</strong><small>{copy.final.subtitle}</small></span>
        </div>
        <div>
          <span className="official-final-actions">
            <Link href={localizeOfficialPath(copy.hero.primaryAction.href, locale)} className="official-btn official-btn-primary">
              <Download size={17} /> {copy.hero.primaryAction.label}
            </Link>
            <Link href={localizeOfficialPath(copy.hero.secondaryAction.href, locale)} className="official-btn official-btn-ghost">
              <FileKey2 size={17} /> {copy.hero.secondaryAction.label}
            </Link>
          </span>
          <p><CheckCircle2 size={15} />{copy.final.notice}</p>
        </div>
      </div>
    </section>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="official-container official-page-header fade-up">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
