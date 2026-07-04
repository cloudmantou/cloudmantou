"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Bookmark,
  CalendarDays,
  Home,
  KeyRound,
  LogIn,
  Menu,
  PenLine,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import clsx from "clsx";
import { siteConfig } from "@/config/site";
import { isAdminRole } from "@/lib/roles";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import { ContactLinksRow } from "@/components/layout/ContactLinksRow";

export type PlatformSection = "home" | "blog" | "shop" | "daily" | "favorites";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: typeof Home;
  match?: (pathname: string) => boolean;
};

const sectionItems: Array<{
  id: PlatformSection;
  label: string;
  icon: typeof Home;
  badge?: string;
}> = [
  { id: "home", label: "首页", icon: Home },
  { id: "blog", label: "技术博客", icon: PenLine },
  { id: "shop", label: "会员与卡密", icon: KeyRound },
  { id: "daily", label: "日常记录", icon: CalendarDays },
  { id: "favorites", label: "收藏夹", icon: Bookmark },
];

function sectionHref(section: PlatformSection) {
  return section === "home" ? "/" : `/?section=${section}`;
}

type Props = {
  mode: "spa" | "routes";
  activeSection?: PlatformSection;
  onSelectSection?: (section: PlatformSection) => void;
  onToast?: (message: string) => void;
  headerExtra?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
};

export function PlatformSidebar({
  mode,
  activeSection = "home",
  onSelectSection,
  onToast,
  headerExtra,
  children,
  mainClassName,
}: Props) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const urlSection = searchParams.get("section") as PlatformSection | null;
  const { data: session } = useSession();
  const isAdmin = isAdminRole(session?.user?.role);
  const [mobileOpen, setMobileOpen] = useState(false);

  const workspaceItems: WorkspaceLink[] = [];
  if (!session) {
    workspaceItems.push({
      href: "/login?callbackUrl=/",
      label: "登录",
      icon: LogIn,
    });
  }
  if (session && !isAdmin) {
    workspaceItems.push({
      href: "/dashboard",
      label: "会员中心",
      icon: UserRound,
      match: (p) => p.startsWith("/dashboard"),
    });
  }
  if (isAdmin) {
    workspaceItems.push({
      href: "/admin",
      label: "后台管理",
      icon: ShieldCheck,
      match: (p) => p.startsWith("/admin"),
    });
  }

  const closeMobile = () => setMobileOpen(false);

  const renderSectionItem = (item: (typeof sectionItems)[number]) => {
    const Icon = item.icon;
    const active =
      mode === "spa"
        ? activeSection === item.id
        : pathname === "/" &&
          (item.id === "home" ? !urlSection || urlSection === "home" : urlSection === item.id);

    if (mode === "spa" && onSelectSection) {
      return (
        <button
          className={clsx("nav-item", active && "active")}
          key={item.id}
          type="button"
          onClick={() => {
            onSelectSection(item.id);
            closeMobile();
          }}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{item.label}</span>
          {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
        </button>
      );
    }

    const href = sectionHref(item.id);

    return (
      <Link
        className={clsx("nav-item", active && "active")}
        key={item.id}
        href={href}
        onClick={closeMobile}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{item.label}</span>
        {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
      </Link>
    );
  };

  return (
    <>
      <header className="mobile-header">
        <span className="mobile-logo">
          馒头<span>博客</span>
        </span>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button
            className="icon-button"
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="打开导航"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <div
        className={clsx("sidebar-overlay", mobileOpen && "show")}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <HomeBackdrop />
      <div className="layout">
      <aside className={clsx("sidebar", mobileOpen && "open")}>
        <div className="sidebar-ambient" aria-hidden="true" />
        <div className="sidebar-grid" aria-hidden="true" />
        <div className="sidebar-scanlines" aria-hidden="true" />
        <div className="sidebar-edge-glow" aria-hidden="true" />
        <div className="sidebar-corner sidebar-corner--tl" aria-hidden="true" />
        <div className="avatar-wrap" aria-hidden="true">
          <span className="avatar-ring" />
          <span className="avatar">馒</span>
        </div>
        <div className="sidebar-name">{siteConfig.name}</div>
        <div className="sidebar-tag">
          <span className="pulse-dot" />
          {siteConfig.subtitle}
        </div>

        <div className="mb-4">
          <SearchDialog />
        </div>

        <nav className="side-nav" aria-label="主导航">
          <div className="nav-section-label">Navigation</div>
          {sectionItems.map(renderSectionItem)}

          <div className="nav-section-label">Workspace</div>
          {workspaceItems.map((item) => {
            const Icon = item.icon;
            const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                className={clsx("nav-item nav-link", active && "active")}
                href={item.href}
                prefetch
                onClick={closeMobile}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            className="nav-item"
            type="button"
            onClick={() => {
              onToast?.("在线工具将在后台模块接入");
              closeMobile();
            }}
          >
            <Settings size={16} aria-hidden="true" />
            <span>在线工具</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <ContactLinksRow />

          {session ? (
            <div className="sidebar-user">
              <div className="sidebar-user-info">
                <span className="sidebar-user-avatar">
                  {(session.user?.nickname || session.user?.username || "U").slice(0, 1).toUpperCase()}
                </span>
                <div className="sidebar-user-meta">
                  <span className="sidebar-user-name">{session.user?.nickname || session.user?.username}</span>
                  <span className="sidebar-user-role">{session.user?.role === "ADMIN" ? "管理员" : "会员"}</span>
                </div>
              </div>
              <button className="sidebar-logout" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
                退出
              </button>
            </div>
          ) : (
            <div className="sidebar-user">
              <Link href="/login?callbackUrl=/" className="sidebar-login-btn" onClick={closeMobile}>
                登录 / 注册
              </Link>
            </div>
          )}
        </div>
      </aside>

        <main className={clsx("main", mainClassName)}>{children}</main>
      </div>
    </>
  );
}