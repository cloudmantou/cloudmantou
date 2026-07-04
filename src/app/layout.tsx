import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildRootMetadata, getSeoContext } from "@/lib/seo";
import "./globals.css";
import "@/styles/cards.css";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSeoContext();
  return buildRootMetadata(ctx);
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSeoContext();

  return (
    <html lang="zh-CN">
      <body>
        <JsonLd ctx={ctx} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}