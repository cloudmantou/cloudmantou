"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  FolderOpen,
  Hash,
  KeyRound,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { href: "/admin/posts", label: "文章", icon: FileText },
  { href: "/admin/comments", label: "评论", icon: MessageSquare },
  { href: "/admin/categories", label: "分类", icon: FolderOpen },
  { href: "/admin/tags", label: "标签", icon: Hash },
  { href: "/admin/cards", label: "卡密", icon: KeyRound },
  { href: "/admin/orders", label: "订单", icon: ShoppingCart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="standalone-page">
      <div className="standalone-shell">
        <Link
          className="ghost-button inline-link"
          href="/"
          style={{ marginBottom: 16 }}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          返回首页
        </Link>

        {/* Admin nav */}
        <nav
          className="flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          aria-label="后台导航"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/admin";
            const isExactDashboard = item.exact && pathname === "/admin";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs whitespace-nowrap transition-colors",
                  (active || isExactDashboard) && "font-medium"
                )}
                style={{
                  background: active || isExactDashboard ? "var(--accent-dim)" : "transparent",
                  color: active || isExactDashboard ? "var(--accent)" : "var(--text-secondary)",
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </main>
  );
}
