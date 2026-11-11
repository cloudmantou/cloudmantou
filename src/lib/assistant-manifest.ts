import { isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

export const MANIFEST_TTL_MS = 24 * 60 * 60 * 1000;
export class ManifestInputError extends Error {}
export function parseManifestInput(query: URLSearchParams, fallbackIP: string) {
  if (query.toString().length > 8192) throw new ManifestInputError("请求过长");
  const values: Record<string, string> = {};
  for (const [key, value] of query) {
    if (Object.hasOwn(values, key)) throw new ManifestInputError("参数重复");
    values[key] = value;
  }
  const field = (key: string, max: number, fallback?: string) => {
    const value = values[key] || fallback || "";
    if (!value || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new ManifestInputError(`参数无效：${key}`);
    return value;
  };
  const bundleId = field("bundle_id", 255);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(bundleId)) throw new ManifestInputError("应用标识无效");
  const version = field("bundle_version", 64);
  const title = field("title", 200);
  const nonce = field("nonce", 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(nonce)) throw new ManifestInputError("nonce 无效");
  const ip = field("client_ip", 64, fallbackIP);
  if (!isIP(ip)) throw new ManifestInputError("设备 IP 无效");
  const port = field("port", 5, "7890");
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new ManifestInputError("端口无效");
  const route = field("route", 2048, "/app.ipa");
  if (!route.startsWith("/") || route.startsWith("//") || /[\\#\s]/.test(route)) throw new ManifestInputError("下载路径无效");
  const ipaUrl = `http://${isIP(ip) === 6 ? `[${ip}]` : ip}:${Number(port)}${route}`;
  // This URL is emitted into a plist only. The server MUST NEVER fetch it.
  const images = ["display_image_url", "full_size_image_url"].map(key => {
    if (!values[key]) return undefined;
    const raw = field(key, 2048);
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new ManifestInputError("图标地址无效");
    return raw;
  });
  return { bundleId, version, title, nonce, ipaUrl, displayImage: images[0], fullImage: images[1], values };
}

export function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}
export function renderManifest(input: ReturnType<typeof parseManifestInput>) {
  const asset = (kind: string, url: string) => `<dict><key>kind</key><string>${kind}</string><key>url</key><string>${xmlEscape(url)}</string></dict>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array>${asset("software-package", input.ipaUrl)}${input.displayImage ? asset("display-image", input.displayImage) : ""}${input.fullImage ? asset("full-size-image", input.fullImage) : ""}</array><key>metadata</key><dict><key>bundle-identifier</key><string>${xmlEscape(input.bundleId)}</string><key>bundle-version</key><string>${xmlEscape(input.version)}</string><key>kind</key><string>software</string><key>title</key><string>${xmlEscape(input.title)}</string></dict></dict></array></dict></plist>`;
}

// PHP previously disabled verification. Observe valid legacy Swift signatures
// during the compatibility window; do not unexpectedly reject installed Apps.
export function validLegacySignature(values: Record<string, string>, secret?: string) {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(values.signature || "")) return false;
  const canonical = Object.keys(values).filter(key => key !== "signature").sort().map(key => `${key}=${values[key]}`).join("&");
  const expected = createHmac("sha256", secret).update(canonical).digest();
  return timingSafeEqual(expected, Buffer.from(values.signature, "hex"));
}

export function manifestBaseURL() {
  const base = new URL(process.env.ASSISTANT_MANIFEST_BASE_URL || "https://install.cloudmantoua.top/backend/manifests/");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("Invalid manifest public base URL");
  return base.href.endsWith("/") ? base.href : `${base.href}/`;
}
