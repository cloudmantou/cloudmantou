import { z } from "zod";

export const IPA_MAX_BYTES = 200 * 1024 * 1024;
export type ArticleIpa = {
  id: string; filename: string; appName: string; bundleId: string;
  version: string; build: string; minIos: string | null;
  bytes: number; sha256: string; notes: string; createdAt: string;
};
export const articleIpaInputSchema = z.array(z.object({
  id: z.string().cuid(),
  version: z.string().trim().min(1, "请填写版本号").max(64),
  notes: z.string().trim().max(5000, "更新说明最多 5000 字"),
})).max(50, "每篇文章最多保留 50 个版本").refine(
  items => new Set(items.map(item => item.id)).size === items.length,
  "安装包不能重复添加",
);
export type ArticleIpaInput = z.infer<typeof articleIpaInputSchema>;
export function ipaDownloadHref(id: string): string {
  return `/api/article-ipa/${id}/download`;
}
export function formatIpaSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function serializeArticleIpa(release: Omit<ArticleIpa, "createdAt"> & { createdAt: Date }): ArticleIpa {
  return {
    id: release.id, filename: release.filename, appName: release.appName,
    bundleId: release.bundleId, version: release.version, build: release.build,
    minIos: release.minIos, bytes: release.bytes, sha256: release.sha256,
    notes: release.notes, createdAt: release.createdAt.toISOString(),
  };
}
/** Single byte ranges only, including open-ended and suffix ranges. */
export function parseIpaRange(header: string | null, size: number): { start: number; end: number } | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) return false;
  return { start, end };
}
