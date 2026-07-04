import { prisma } from "@/lib/prisma";
import { parseContactLinks, type ContactLink } from "@/lib/contact-links";

import {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
} from "@/config/site";

export type SiteSettings = {
  openRegistration: boolean;
  commentReview: boolean;
  maintenanceMode: boolean;
  siteUrl: string;
  siteName: string;
  siteSubtitle: string;
  siteDescription: string;
  homeTypingPhrases: string[];
  contactLinks: ContactLink[];
};

export const DEFAULT_HOME_TYPING_PHRASES = [
  "记录开发、运维、独立产品和自动发卡系统的真实实践。",
  "公开文章免费阅读 · 深度内容支持会员或卡密解锁。",
  "Next.js · Prisma · MySQL · NextAuth · Docker",
  "也维护自研工具馒头助手，支持香色闺阁、源阅读等 iOS 应用安装。",
];

const DEFAULTS: SiteSettings = {
  openRegistration: true,
  commentReview: true,
  maintenanceMode: false,
  siteUrl: DEFAULT_SITE_URL,
  siteName: BRAND_NAME,
  siteSubtitle: DEFAULT_SITE_SUBTITLE,
  siteDescription: DEFAULT_SITE_DESCRIPTION,
  homeTypingPhrases: DEFAULT_HOME_TYPING_PHRASES,
  contactLinks: [],
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
        in: [
          "openRegistration",
          "commentReview",
          "maintenanceMode",
          "siteUrl",
          "siteName",
          "siteSubtitle",
          "siteDescription",
          "homeTypingPhrases",
          "contactLinks",
        ],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  let homeTypingPhrases = DEFAULTS.homeTypingPhrases;
  if (map.homeTypingPhrases) {
    try {
      const parsed = JSON.parse(map.homeTypingPhrases);
      if (Array.isArray(parsed)) {
        const lines = parsed.filter(
          (line): line is string => typeof line === "string" && line.trim().length > 0
        );
        if (lines.length > 0) homeTypingPhrases = lines;
      }
    } catch {
      /* keep defaults */
    }
  }

  const value: SiteSettings = {
    openRegistration: map.openRegistration !== "false",
    commentReview: map.commentReview !== "false",
    maintenanceMode: map.maintenanceMode === "true",
    siteUrl: map.siteUrl || DEFAULTS.siteUrl,
    siteName: map.siteName || DEFAULTS.siteName,
    siteSubtitle: map.siteSubtitle || DEFAULTS.siteSubtitle,
    siteDescription: map.siteDescription || DEFAULTS.siteDescription,
    homeTypingPhrases,
    contactLinks: parseContactLinks(map.contactLinks),
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