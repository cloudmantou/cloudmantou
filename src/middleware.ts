import { auth } from "@/lib/auth";
import { isAllowedAdminMutationOrigin } from "@/lib/csrf-origin";
import { NextResponse } from "next/server";

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

export default auth(async (req) => {
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
        return NextResponse.json(
          { code: 50300, message: "站点维护中，请稍后再试" },
          { status: 503 }
        );
      }
      return NextResponse.rewrite(new URL("/maintenance", req.url));
    }
  }

  if (
    pathname.startsWith("/api/admin") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method || "")
  ) {
    if (!isAllowedAdminMutationOrigin(req)) {
      return NextResponse.json(
        { code: 40300, message: "跨站请求被拒绝" },
        { status: 403 }
      );
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { code: 40100, message: "请先登录" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { code: 40300, message: "无访问权限" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/dashboard", req.url));
    }
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
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
      return NextResponse.json(
        { code: 40100, message: "请先登录" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
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