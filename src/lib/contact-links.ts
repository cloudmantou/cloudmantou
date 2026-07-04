import { isSafeCoverImageUrl, isSafeExternalHref } from "@/lib/safe-image-url";

export const CONTACT_LINK_KINDS = [
  "wechat_official",
  "wechat",
  "telegram",
  "email",
  "github",
  "custom",
] as const;

export type ContactLinkKind = (typeof CONTACT_LINK_KINDS)[number];

export type ContactLink = {
  id: string;
  kind: ContactLinkKind;
  label: string;
  enabled: boolean;
  sortOrder: number;
  href?: string;
  iconUrl?: string;
  qrImageUrl?: string;
};

export const CONTACT_LINK_PRESETS: Array<{
  kind: ContactLinkKind;
  label: string;
  hint: string;
}> = [
  { kind: "wechat_official", label: "微信公众号", hint: "通常上传公众号二维码" },
  { kind: "wechat", label: "微信", hint: "个人微信二维码或微信号链接" },
  { kind: "telegram", label: "Telegram", hint: "填写 t.me 链接" },
  { kind: "email", label: "邮箱", hint: "填写邮箱或 mailto: 链接" },
  { kind: "github", label: "GitHub", hint: "仓库或个人主页链接" },
  { kind: "custom", label: "自定义", hint: "任意名称与链接" },
];

const MAX_LINKS = 12;

function normalizeHref(kind: ContactLinkKind, href: string | undefined): string | undefined {
  const trimmed = href?.trim();
  if (!trimmed) return undefined;
  if (kind === "email" && !trimmed.startsWith("mailto:") && trimmed.includes("@")) {
    return `mailto:${trimmed}`;
  }
  return trimmed;
}

function sanitizeImageUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return isSafeCoverImageUrl(trimmed) ? trimmed : undefined;
}

export function sanitizeContactLink(raw: unknown, index: number): ContactLink | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const kind = item.kind;
  if (typeof kind !== "string" || !CONTACT_LINK_KINDS.includes(kind as ContactLinkKind)) {
    return null;
  }

  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 64) : `link-${index}`;
  const label =
    typeof item.label === "string" && item.label.trim()
      ? item.label.trim().slice(0, 40)
      : CONTACT_LINK_PRESETS.find((p) => p.kind === kind)?.label || "联系方式";

  const hrefRaw = normalizeHref(kind as ContactLinkKind, typeof item.href === "string" ? item.href : undefined);
  const href = hrefRaw && isSafeExternalHref(hrefRaw) ? hrefRaw.slice(0, 500) : undefined;
  const iconUrl = sanitizeImageUrl(typeof item.iconUrl === "string" ? item.iconUrl : undefined);
  const qrImageUrl = sanitizeImageUrl(typeof item.qrImageUrl === "string" ? item.qrImageUrl : undefined);

  if (!href && !qrImageUrl) return null;

  const sortOrder =
    typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
      ? Math.max(0, Math.min(99, Math.floor(item.sortOrder)))
      : index;

  return {
    id,
    kind: kind as ContactLinkKind,
    label,
    enabled: item.enabled !== false,
    sortOrder,
    href,
    iconUrl,
    qrImageUrl,
  };
}

export function parseContactLinks(raw: string | null | undefined): ContactLink[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => sanitizeContactLink(item, index))
      .filter((item): item is ContactLink => item !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_LINKS);
  } catch {
    return [];
  }
}

export function serializeContactLinks(links: ContactLink[]): string {
  return JSON.stringify(
    links
      .map((link, index) => sanitizeContactLink(link, index))
      .filter((link): link is ContactLink => link !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_LINKS)
  );
}

export function getPublicContactLinks(links: ContactLink[]): ContactLink[] {
  return links.filter((link) => link.enabled);
}

export function extractEmailFromHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;

  const address = trimmed.toLowerCase().startsWith("mailto:")
    ? trimmed.slice(7).split("?")[0].trim()
    : trimmed;

  return address.includes("@") ? address : null;
}