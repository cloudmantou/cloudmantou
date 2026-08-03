import type { Metadata } from "next";
import { Suspense } from "react";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { getRequestLocale } from "@/i18n/server";
import { buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildPageMetadata(withEditorialSeoContext(await getSeoContext(locale)), {
    title: locale === "en" ? "Account & access" : "账户与权益",
    description: locale === "en" ? "Review memberships, purchased access, and orders." : "查看会员状态、已购权益与订单记录。",
    path: "/dashboard",
  });
}

export default async function DashboardPage() {
  const locale = await getRequestLocale();
  return (
    <EditorialShell locale={locale}>
      <main style={{ minHeight: "calc(100vh - 236px)", padding: "clamp(38px, 7vw, 84px) 16px" }}>
        <div className="editorial-container" style={{ paddingInline: "clamp(4px, 1vw, 16px)" }}>
          <Suspense fallback={null}><UserDashboard /></Suspense>
        </div>
      </main>
    </EditorialShell>
  );
}
