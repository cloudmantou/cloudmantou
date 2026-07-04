import type { Metadata } from "next";
import { Suspense } from "react";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { MarketingShell } from "@/components/layout/MarketingShell";

export const metadata: Metadata = {
  title: "会员中心",
};

export default function DashboardPage() {
  return (
    <MarketingShell>
      <Suspense fallback={null}>
        <UserDashboard />
      </Suspense>
    </MarketingShell>
  );
}