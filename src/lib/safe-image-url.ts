const UPLOAD_PATH_RE = /^\/uploads\/[\w./-]+$/;

/** 评论头像：仅允许本站上传路径 */
export function isSafeAvatarSrc(src: string | null | undefined): boolean {
  if (!src?.trim()) return false;
  return UPLOAD_PATH_RE.test(src.trim());
}

/** Markdown 图片：拒绝 javascript:/data:，仅 http(s) 或 /uploads/ */
export function isSafeMarkdownImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (trimmed.startsWith("/")) return UPLOAD_PATH_RE.test(trimmed);
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** 外链：拒绝危险协议，允许 http(s)/mailto/站内锚点 */
export function isSafeExternalHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return true;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

/** 封面图：/uploads/、受限 data URL（禁 SVG）、或 https 外链 */
export function isSafeCoverImageUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (UPLOAD_PATH_RE.test(trimmed)) return true;
  if (trimmed.startsWith("data:image/")) {
    if (/^data:image\/svg/i.test(trimmed)) return false;
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed);
  }
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}