import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildContentSecurityPolicy, generateCspNonce } from "@/config/csp";
import { authConfig } from "@/lib/auth.config";
import { isAllowedAdminMutationOrigin } from "@/lib/csrf-origin";

const { auth } = NextAuth(authConfig);

async function fetchMaintenanceMode(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/site/settings/public`, {
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

function nextWithCsp(req: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return response;
}

export default auth(async (req) => {
  const nonce = generateCspNonce();
  const { pathname } = req.nextUrl;
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
      const response = NextResponse.rewrite(new URL("/maintenance", req.url), {
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

  return nextWithCsp(req, nonce);
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