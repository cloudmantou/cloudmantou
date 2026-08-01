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

/** 管理端变更请求：Origin/Referer 必须与站点 scheme + host + port 完全同源。 */
export function isAllowedAdminMutationOrigin(req: NextRequest): boolean {
  const allowed = collectAllowedOrigins(req);
  if (allowed.size === 0) return process.env.NODE_ENV !== "production";

  const origin = req.headers.get("origin");
  if (origin) return originMatches(origin, allowed);

  const referer = req.headers.get("referer");
  if (referer) return originMatches(referer, allowed);

  return process.env.NODE_ENV !== "production";
}
