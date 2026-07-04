import type { Metadata } from "next";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { buildPageMetadata, getSeoContext } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSeoContext();
  return buildPageMetadata(ctx, {
    title: `${ctx.name} — ${ctx.subtitle}`,
    description: ctx.description,
    path: "/",
  });
}

export default function HomePage() {
  return <PlatformShell />;
}