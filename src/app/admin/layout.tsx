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
  Users,
  CreditCard,
  Settings,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { href: "/admin/posts", label: "文章", icon: FileText },
  { href: "/admin/comments", label: "评论", icon: MessageSquare },
  { href: "/admin/categories", label: "分类", icon: FolderOpen },
  { href: "/admin/tags", label: "标签", icon: Hash },
  { href: "/admin/cards", label: "卡密", icon: KeyRound },
  { href: "/admin/orders", label: "订单", icon: ShoppingCart },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/payments", label: "支付", icon: CreditCard },
  { href: "/admin/settings", label: "设置", icon: Settings },
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
        <nav className="admin-tabbar" aria-label="后台导航">
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
                className={`admin-tab${active || isExactDashboard ? " active" : ""}`}
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
