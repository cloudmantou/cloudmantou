import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 后台管理：必须 ADMIN
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
    if (session.user?.role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { code: 40300, message: "无访问权限" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 用户中心：仅管理员可访问，普通会员在首页完成登录/购买/评论
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/", req.url));
    }
    if (session.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 写操作 API：必须登录（排除 auth 和 payment 回调）
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method || "") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/payment/notify")
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
  matcher: ["/admin/:path*", "/dashboard/:path*", "/api/:path*"],
};
