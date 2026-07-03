"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  FolderOpen,
  Hash,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: number;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "概览",
    items: [{ href: "/admin", label: "仪表盘", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "内容管理",
    items: [
      { href: "/admin/posts", label: "文章管理", icon: FileText },
      { href: "/admin/comments", label: "评论管理", icon: MessageSquare },
      { href: "/admin/categories", label: "分类标签", icon: FolderOpen },
      { href: "/admin/tags", label: "标签", icon: Hash },
    ],
  },
  {
    title: "用户系统",
    items: [
      { href: "/admin/users", label: "用户管理", icon: Users },
    ],
  },
  {
    title: "商业运营",
    items: [
      { href: "/admin/orders", label: "订单管理", icon: ShoppingCart },
      { href: "/admin/cards", label: "卡密管理", icon: KeyRound },
      { href: "/admin/payment-gateway", label: "支付对接", icon: Wallet },
      { href: "/admin/payments", label: "支付记录", icon: CreditCard },
    ],
  },
  {
    title: "系统",
    items: [{ href: "/admin/settings", label: "系统设置", icon: Settings }],
  },
];

const pageTitles: Record<string, string> = {
  "/admin": "仪表盘",
  "/admin/posts": "文章管理",
  "/admin/comments": "评论管理",
  "/admin/categories": "分类标签",
  "/admin/tags": "标签管理",
  "/admin/users": "用户管理",
  "/admin/orders": "订单管理",
  "/admin/cards": "卡密管理",
  "/admin/payment-gateway": "支付对接",
  "/admin/payments": "支付记录",
  "/admin/settings": "系统设置",
};

function resolveTitle(pathname: string) {
  if (pathname.includes("/admin/posts/new")) return "新建文章";
  if (pathname.includes("/admin/posts/") && pathname.endsWith("/edit")) return "编辑文章";
  const match = Object.keys(pageTitles)
    .filter((key) => key !== "/admin")
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));
  if (match) return pageTitles[match];
  if (pathname === "/admin") return pageTitles["/admin"];
  return "后台管理";
}

function isEditorRoute(pathname: string) {
  return /^\/admin\/posts\/(new|[^/]+\/edit)$/.test(pathname);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const editorMode = isEditorRoute(pathname);

  if (editorMode) {
    return <div className="admin-root admin-editor-bleed">{children}</div>;
  }

  const title = resolveTitle(pathname);
  const displayName = session?.user?.nickname || session?.user?.username || "管理员";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="admin-root">
      <div
        className={clsx("admin-overlay", mobileOpen && "show")}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={clsx("admin-sidebar", mobileOpen && "open")}>
        <div className="admin-brand">
          <div className="admin-brand-icon">CM</div>
          <div className="admin-brand-text">
            <h2>CloudMantou</h2>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="后台导航">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <p className="admin-nav-group-title">{group.title}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href) && item.href !== "/admin";
                const isDashboard = item.exact && pathname === "/admin";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx("admin-nav-item", (active || isDashboard) && "active")}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge ? <span className="admin-nav-badge">{item.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-avatar-sm">{initial}</div>
          <div>
            <h4>{displayName}</h4>
            <span>{session?.user?.email || "admin@cloudmantou.dev"}</span>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="打开菜单"
            >
              <Menu size={18} />
            </button>
            <div>
              <div className="admin-breadcrumb">
                <span>后台管理</span>
                <span>/</span>
                <span className="current">{title}</span>
              </div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="admin-topbar-right">
            <Link href="/" className="admin-topbar-btn" title="返回前台" aria-label="返回前台">
              <ArrowLeft size={16} />
            </Link>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}