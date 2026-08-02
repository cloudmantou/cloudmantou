import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildContentSecurityPolicy, generateCspNonce } from "@/config/csp";
import { isOfficialSite } from "@/config/site";
import { authConfig } from "@/lib/auth.config";
import { isAllowedAdminMutationOrigin } from "@/lib/csrf-origin";
import {
  OFFICIAL_LOCALE_COOKIE,
  buildOfficialRewriteUrl,
  resolveOfficialRequest,
  resolveRoutedOfficialRequest,
  type OfficialRequestResolution,
} from "@/i18n/official";

const { auth } = NextAuth(authConfig);

async function fetchMaintenanceMode(origin: string): Promise<boolean> {
  try {
    const internalOrigin = (process.env.INTERNAL_SITE_URL?.trim() || origin).replace(/\/$/, "");
    const res = await fetch(`${internalOrigin}/api/site/settings/public`, {
      headers: { "x-middleware-prefetch": "1" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.data?.maintenanceMode);
  } catch {
    return false;
  }
}

function withCsp(_req: NextRequest, response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return response;
}

function getInternalRewriteUrl(req: NextRequest, pathname: string): URL {
  return buildOfficialRewriteUrl(req.url, pathname);
}

function nextWithCsp(
  req: NextRequest,
  nonce: string,
  localeResolution?: OfficialRequestResolution
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-official-internal-rewrite");
  requestHeaders.set("x-nonce", nonce);
  if (localeResolution?.locale) {
    requestHeaders.set("x-official-locale", localeResolution.locale);
  } else if (req.nextUrl.pathname !== "/payment/result") {
    requestHeaders.set("x-official-locale", "zh");
  }

  const rewritePath = localeResolution?.rewritePath;
  if (rewritePath) {
    requestHeaders.set("x-official-internal-rewrite", "1");
  }
  const response = rewritePath
    ? NextResponse.rewrite(getInternalRewriteUrl(req, rewritePath), {
        request: { headers: requestHeaders },
      })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  if (localeResolution?.locale) {
    response.headers.set("Content-Language", localeResolution.locale === "en" ? "en" : "zh-CN");
  }
  if (localeResolution?.persistLocale) {
    response.cookies.set(OFFICIAL_LOCALE_COOKIE, localeResolution.persistLocale, {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export default auth(async (req) => {
  const nonce = generateCspNonce();
  const routedLocaleResolution = resolveRoutedOfficialRequest(
    req.headers.get("x-official-locale"),
    req.headers.get("x-official-internal-rewrite")
  );
  const localeResolution: OfficialRequestResolution = isOfficialSite
    ? routedLocaleResolution ||
      resolveOfficialRequest({
          pathname: req.nextUrl.pathname,
          method: req.method,
          cookieHeader: req.headers.get("cookie"),
          acceptLanguage: req.headers.get("accept-language"),
        })
    : { locale: null, redirectPath: null, rewritePath: null, persistLocale: null };

  if (localeResolution.redirectPath) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = localeResolution.redirectPath;
    const response = withCsp(req, NextResponse.redirect(redirectUrl, 307), nonce);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Content-Language", "en");
    response.headers.append("Vary", "Accept-Language, Cookie");
    return response;
  }

  const pathname = localeResolution.rewritePath || req.nextUrl.pathname;
  const session = req.auth;
  const isAdmin = session?.user?.role === "ADMIN";

  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/site/settings/public") &&
    !pathname.startsWith("/api/payment/notify") &&
    !pathname.startsWith("/api/cron") &&
    !pathname.startsWith("/api/auth") &&
    pathname !== "/maintenance"
  ) {
    const maintenance = await fetchMaintenanceMode(req.nextUrl.origin);
    if (maintenance && !isAdmin) {
      if (pathname.startsWith("/api/")) {
        return withCsp(
          req,
          NextResponse.json({ code: 50300, message: "站点维护中，请稍后再试" }, { status: 503 }),
          nonce
        );
      }
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-nonce", nonce);
      requestHeaders.set("x-official-locale", localeResolution.locale || "zh");
      const response = NextResponse.rewrite(getInternalRewriteUrl(req, "/maintenance"), {
        request: { headers: requestHeaders },
      });
      response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
      return response;
    }
  }

  if (
    pathname.startsWith("/api/admin") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method || "")
  ) {
    if (!isAllowedAdminMutationOrigin(req)) {
      return withCsp(
        req,
        NextResponse.json({ code: 40300, message: "跨站请求被拒绝" }, { status: 403 }),
        nonce
      );
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return withCsp(
          req,
          NextResponse.json({ code: 40100, message: "请先登录" }, { status: 401 }),
          nonce
        );
      }
      return withCsp(req, NextResponse.redirect(new URL("/login", req.url)), nonce);
    }
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return withCsp(
          req,
          NextResponse.json({ code: 40300, message: "无访问权限" }, { status: 403 }),
          nonce
        );
      }
      return withCsp(req, NextResponse.redirect(new URL("/", req.url)), nonce);
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return withCsp(
        req,
        NextResponse.redirect(new URL("/login?callbackUrl=/dashboard", req.url)),
        nonce
      );
    }
    if (isAdmin) {
      return withCsp(req, NextResponse.redirect(new URL("/admin", req.url)), nonce);
    }
  }

  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method || "") &&
    !pathname.startsWith("/api/auth/login") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/payment/notify") &&
    !pathname.startsWith("/api/site/settings/public")
  ) {
    if (!session) {
      return withCsp(
        req,
        NextResponse.json({ code: 40100, message: "请先登录" }, { status: 401 }),
        nonce
      );
    }
  }

  return nextWithCsp(req, nonce, localeResolution);
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/:path*",
    "/maintenance",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
