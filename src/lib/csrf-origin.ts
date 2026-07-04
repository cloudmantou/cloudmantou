import type { NextRequest } from "next/server";

function collectAllowedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const reqHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (reqHost) {
    hosts.add(reqHost.split(",")[0].trim().split(":")[0]);
  }

  for (const envKey of ["AUTH_URL", "SITE_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
    const value = process.env[envKey]?.trim();
    if (!value) continue;
    try {
      hosts.add(new URL(value).host.split(":")[0]);
    } catch {
      // ignore invalid env URL
    }
  }

  return hosts;
}

function hostMatches(urlValue: string, allowed: Set<string>): boolean {
  try {
    return allowed.has(new URL(urlValue).host.split(":")[0]);
  } catch {
    return false;
  }
}

/** 管理端变更请求：Origin/Referer 必须与站点 host 一致 */
export function isAllowedAdminMutationOrigin(req: NextRequest): boolean {
  const allowed = collectAllowedHosts(req);
  if (allowed.size === 0) return process.env.NODE_ENV !== "production";

  const origin = req.headers.get("origin");
  if (origin) return hostMatches(origin, allowed);

  const referer = req.headers.get("referer");
  if (referer) return hostMatches(referer, allowed);

  return process.env.NODE_ENV !== "production";
}