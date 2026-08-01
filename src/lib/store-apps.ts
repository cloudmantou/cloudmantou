export const STORE_APP_CATEGORIES = ["READING", "TOOL", "ENTERTAINMENT", "OTHER"] as const;

export type StoreAppCategory = (typeof STORE_APP_CATEGORIES)[number];

export type StoreAppPublic = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string;
  iconUrl: string | null;
  coverUrl: string | null;
  screenshots: string[];
  category: StoreAppCategory;
  featured: boolean;
  minIos: string | null;
  installUrl?: string;
};

export const STORE_CATEGORY_LABELS: Record<StoreAppCategory, string> = {
  READING: "阅读",
  TOOL: "工具",
  ENTERTAINMENT: "娱乐",
  OTHER: "其他",
};

const SUPPORTED_INSTALL_PROTOCOLS = new Set(["https:", "mantou:", "itms-services:"]);

export function parseScreenshots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function isSupportedStoreInstallUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;

  try {
    return SUPPORTED_INSTALL_PROTOCOLS.has(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
