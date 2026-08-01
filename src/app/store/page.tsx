import type { Metadata } from "next";
import { OfficialShell } from "@/components/official/OfficialShell";
import { StorePageClient } from "@/components/official/StorePageClient";
import { prisma } from "@/lib/prisma";
import type { StoreAppPublic } from "@/lib/store-apps";
import { toPublicStoreApp } from "@/lib/store-apps.server";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";
import { getOfficialMessages } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getOfficialMessages(locale).pages.store;
  const ctx = await getSeoContext(locale);
  return buildPageMetadata(ctx, {
    title: copy.title,
    description: copy.metaDescription,
    path: "/store",
  });
}

export default async function StorePage() {
  let apps: StoreAppPublic[] = [];
  try {
    const rows = await prisma.storeApp.findMany({
      where: { published: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    });
    apps = rows.map((row) => toPublicStoreApp(row));
  } catch {
    apps = [];
  }

  return (
    <OfficialShell>
      <StorePageClient apps={apps} />
    </OfficialShell>
  );
}
