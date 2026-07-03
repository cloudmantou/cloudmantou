import type { Metadata } from "next";
import { UserDashboard } from "@/components/dashboard/UserDashboard";

export const metadata: Metadata = {
  title: "会员中心",
};

export default function DashboardPage() {
  return (
    <div className="standalone-page">
      <div className="standalone-shell">
        <UserDashboard />
      </div>
    </div>
  );
}