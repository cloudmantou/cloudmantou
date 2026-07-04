/** 标签 slug：仅小写字母、数字、连字符 */
export function normalizeTagSlug(name: string): string {
  return name
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}