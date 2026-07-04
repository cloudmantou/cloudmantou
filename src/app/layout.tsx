import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCspNonce } from "@/lib/csp-nonce";
import { buildRootMetadata, getSeoContext } from "@/lib/seo";
import "./globals.css";
import "@/styles/cards.css";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSeoContext();
  return buildRootMetadata(ctx);
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [ctx, nonce] = await Promise.all([getSeoContext(), getCspNonce()]);

  return (
    <html lang="zh-CN">
      <body>
        <JsonLd ctx={ctx} nonce={nonce} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}