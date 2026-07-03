import { prisma } from "@/lib/prisma";

export type SiteSettings = {
  openRegistration: boolean;
  commentReview: boolean;
  maintenanceMode: boolean;
  siteUrl: string;
};

const DEFAULTS: SiteSettings = {
  openRegistration: true,
  commentReview: true,
  maintenanceMode: false,
  siteUrl: "",
};

let cache: { value: SiteSettings; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: ["openRegistration", "commentReview", "maintenanceMode", "siteUrl"],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  const value: SiteSettings = {
    openRegistration: map.openRegistration !== "false",
    commentReview: map.commentReview !== "false",
    maintenanceMode: map.maintenanceMode === "true",
    siteUrl: map.siteUrl || "",
  };

  cache = { value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function invalidateSiteSettingsCache() {
  cache = null;
}

export async function getInitialCommentStatus(): Promise<"PENDING" | "APPROVED"> {
  const settings = await getSiteSettings();
  return settings.commentReview ? "PENDING" : "APPROVED";
}