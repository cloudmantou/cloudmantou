import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfficialShell } from "@/components/official/OfficialShell";
import { toPublicStoreApp, userCanAccessStoreInstall } from "@/lib/store-apps.server";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages, localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.storeDetail;
  const ctx = await getSeoContext(locale);
  const app = await prisma.storeApp.findFirst({
    where: { slug, published: true },
    select: { name: true, tagline: true, description: true },
  });

  if (!app) {
    return { title: copy.notFound };
  }

  return buildPageMetadata(ctx, {
    title: `${app.name} ${copy.installSuffix}`,
    description: app.tagline || app.description.slice(0, 140),
    path: `/store/${slug}`,
  });
}

export default async function StoreAppDetailPage({ params }: PageProps) {
  const locale = await getRequestLocale();
  const messages = getOfficialMessages(locale);
  const copy = messages.pages.storeDetail;
  const filters = messages.pages.store.filters;
  const categoryLabels = {
    READING: filters.reading,
    TOOL: filters.tool,
    ENTERTAINMENT: filters.entertainment,
    OTHER: filters.other,
  } as const;
  const { slug } = await params;
  const app = await prisma.storeApp.findFirst({ where: { slug, published: true } });
  if (!app) notFound();

  const session = await auth();
  const canInstall = await userCanAccessStoreInstall(session?.user?.id);
  const publicApp = toPublicStoreApp(app, canInstall);

  return (
    <OfficialShell>
      <div className="official-container official-detail-hero">
        <div className="official-detail-meta">
          {app.featured ? <span className="official-tag official-tag-featured">{copy.featured}</span> : null}
          <span className="official-tag">{categoryLabels[app.category]}</span>
          {app.minIos ? <span className="official-tag">iOS {app.minIos}+</span> : null}
        </div>
        <h1 style={{ margin: 0, fontFamily: "Syne, Noto Sans SC, sans-serif", fontSize: "2rem" }}>
          {app.name}
        </h1>
        {app.tagline ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>{app.tagline}</p>
        ) : null}
        <div className="official-prose" style={{ maxWidth: 720 }}>
          <p>{app.description}</p>
        </div>

        {canInstall && publicApp.installUrl ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: "1px solid rgba(77,217,182,0.3)",
              background: "var(--teal-dim)",
            }}
          >
            <strong style={{ color: "var(--teal)" }}>{copy.accessValid}</strong>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {copy.installReady}
            </p>
            <a
              href={publicApp.installUrl}
              className="official-btn official-btn-primary"
              style={{ display: "inline-flex", marginTop: 12 }}
              {...(publicApp.installUrl.startsWith("https:")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {copy.openInstall}
            </a>
          </div>
        ) : canInstall ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          >
            <strong>{copy.accessValid}</strong>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {copy.installMissing}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--text-secondary)", margin: "0 0 12px" }}>
              {copy.accessRequired}
            </p>
            <Link href={localizeOfficialPath("/pricing", locale)} className="official-btn official-btn-primary">
              {copy.viewMembership}
            </Link>
          </div>
        )}

        <Link href={localizeOfficialPath("/store", locale)} className="official-btn official-btn-ghost" style={{ width: "fit-content" }}>
          {copy.back}
        </Link>
      </div>
    </OfficialShell>
  );
}
