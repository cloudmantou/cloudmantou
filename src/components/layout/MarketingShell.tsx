"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Home, Menu, X } from "lucide-react";
import clsx from "clsx";
import { siteConfig } from "@/config/site";
import { isAdminRole } from "@/lib/roles";

/**
 * MarketingShell —— 营销/内容页通用骨架
 *
 * 与 PlatformShell 的区别：本组件是纯 chrome（侧栏 + 移动头 + main 容器），
 * 不持有 SPA section 状态，children 由调用方提供。用于：
 *   - /post/[slug]  文章详情
 *   - /category/[slug]  分类列表
 *   - /not-found  404
 */
type NavLink = {
  href: string;
  label: string;
  icon?: typeof Home;
  matchPrefix?: string;
};

function buildNavLinks(session: { user?: { role?: string } } | null | undefined) {
  const isAdmin = isAdminRole(session?.user?.role);
  const links: NavLink[] = [
    { href: "/", label: "首页", icon: Home, matchPrefix: "" },
    { href: "/category/engineering", label: "技术博客", matchPrefix: "/category" },
  ];
  if (!session) {
    links.push({ href: "/login?callbackUrl=/", label: "登录" });
  }
  if (isAdmin) {
    links.push({ href: "/admin", label: "后台管理" });
  }
  return links;
}

export function MarketingShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname() || "/";

  return (
    <>
      {/* 移动端顶栏 */}
      <header className="mobile-header">
        <span className="mobile-logo">
          Cloud<span>Mantou</span>
        </span>
        <button
          className="icon-button"
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="打开导航"
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <div
        className={clsx("sidebar-overlay", mobileOpen && "show")}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="layout">
        <aside className={clsx("sidebar", mobileOpen && "open")}>
          <div className="avatar-wrap" aria-hidden="true">
            <span className="avatar-ring" />
            <span className="avatar">CM</span>
          </div>
          <div className="sidebar-name">{siteConfig.name}</div>
          <div className="sidebar-tag">
            <span className="pulse-dot" />
            在线 · 会员平台
          </div>

          <nav className="side-nav" aria-label="主导航">
            <div className="nav-section-label">Navigation</div>
            {buildNavLinks(session).map((item) => {
              const Icon = item.icon;
              const active = item.matchPrefix
                ? pathname.startsWith(item.matchPrefix)
                : item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx("nav-item", active && "active")}
                  onClick={() => setMobileOpen(false)}
                >
                  {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {session ? (
            <div className="sidebar-user">
              <div className="sidebar-user-info">
                <span className="sidebar-user-avatar">
                  {(session.user?.nickname || session.user?.username || "U")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <div className="sidebar-user-meta">
                  <span className="sidebar-user-name">
                    {session.user?.nickname || session.user?.username}
                  </span>
                  <span className="sidebar-user-role">
                    {session.user?.role === "ADMIN" ? "管理员" : "会员"}
                  </span>
                </div>
              </div>
              <button
                className="sidebar-logout"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                退出
              </button>
            </div>
          ) : (
            <div className="sidebar-user">
              <Link href="/login" className="sidebar-login-btn">
                登录 / 注册
              </Link>
            </div>
          )}
        </aside>

        <main className="main marketing-main">{children}</main>
      </div>
    </>
  );
}
