import type { NextRequest } from "next/server";

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function collectAllowedOrigins(req: NextRequest): Set<string> {
  const origins = new Set<string>();
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  const hostHeader = trustProxyHeaders
    ? req.headers.get("x-forwarded-host") || req.headers.get("host")
    : req.headers.get("host");
  const host = hostHeader?.split(",")[0].trim();
  const forwardedProto = trustProxyHeaders
    ? req.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    : null;
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : req.nextUrl.protocol.replace(/:$/, "");
  if (host) {
    const requestOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (requestOrigin) origins.add(requestOrigin);
  }

  for (const envKey of ["AUTH_URL", "SITE_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
    const value = process.env[envKey]?.trim();
    if (!value) continue;
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  }

  return origins;
}

function originMatches(urlValue: string, allowed: Set<string>): boolean {
  const origin = normalizeOrigin(urlValue);
  return origin !== null && allowed.has(origin);
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 由第三方服务器调用、自带签名或密钥校验的写接口，不受浏览器同源约束。 */
const CROSS_SITE_MUTATION_PREFIXES = ["/api/payment/notify/", "/api/cron/"] as const;

/** 判断该请求是否必须通过同源校验：所有 /api 写请求，第三方回调与 cron 除外。 */
export function requiresSameOriginMutation(pathname: string, method: string | null | undefined): boolean {
  if (!MUTATION_METHODS.has((method || "").toUpperCase())) return false;
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return false;
  return !CROSS_SITE_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** 浏览器写请求：Origin/Referer 必须与站点 scheme + host + port 完全同源。 */
export function isAllowedMutationOrigin(req: NextRequest): boolean {
  const allowed = collectAllowedOrigins(req);
  if (allowed.size === 0) return process.env.NODE_ENV !== "production";

  const origin = req.headers.get("origin");
  if (origin) return originMatches(origin, allowed);

  const referer = req.headers.get("referer");
  if (referer) return originMatches(referer, allowed);

  return process.env.NODE_ENV !== "production";
}

/** @deprecated 使用 isAllowedMutationOrigin；保留旧名称兼容现有调用方。 */
export const isAllowedAdminMutationOrigin = isAllowedMutationOrigin;

/** JSON 写接口必须声明 application/json，阻止 text/plain 表单拼接 JSON 的简单请求。 */
export function hasJsonContentType(req: Request): boolean {
  const mediaType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  return mediaType === "application/json";
}
