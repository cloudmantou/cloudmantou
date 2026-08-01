import type { StoreApp } from "@prisma/client";
import { hasActiveMembership } from "@/lib/membership-service";
import { prisma } from "@/lib/prisma";
import { isSafeCoverImageUrl } from "@/lib/safe-image-url";
import {
  isSupportedStoreInstallUrl,
  parseScreenshots,
  type StoreAppPublic,
} from "@/lib/store-apps";

function publicImageUrl(value: string | null): string | null {
  return value && isSafeCoverImageUrl(value) ? value : null;
}

export function toPublicStoreApp(app: StoreApp, includeInstall = false): StoreAppPublic {
  const screenshots = parseScreenshots(app.screenshots).filter(isSafeCoverImageUrl);

  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    tagline: app.tagline,
    description: app.description,
    iconUrl: publicImageUrl(app.iconUrl),
    coverUrl: publicImageUrl(app.coverUrl),
    screenshots,
    category: app.category,
    featured: app.featured,
    minIos: app.minIos,
    ...(includeInstall && isSupportedStoreInstallUrl(app.installUrl)
      ? { installUrl: app.installUrl.trim() }
      : {}),
  };
}

export async function listPublishedStoreApps(): Promise<StoreAppPublic[]> {
  const apps = await prisma.storeApp.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return apps.map((app) => toPublicStoreApp(app));
}

export async function userCanAccessStoreInstall(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  return hasActiveMembership(userId);
}
