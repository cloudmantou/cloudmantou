import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import "./globals.css";
import "@/styles/cards.css";

export const metadata: Metadata = {
  title: {
    default: "CloudMantou — 博客会员平台",
    template: "%s | CloudMantou",
  },
  description: "个人博客、会员付费内容、自动卡密交付与运营后台一体化平台。",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "CloudMantou",
    title: "CloudMantou — 博客会员平台",
    description: "个人博客、会员付费内容、自动卡密交付与运营后台一体化平台。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
