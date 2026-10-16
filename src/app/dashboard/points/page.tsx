import { EditorialShell } from "@/components/editorial/EditorialShell";
import { PointsCenter } from "@/components/feedback/PointsCenter";
import { getRequestLocale } from "@/i18n/server";
export const metadata = { title: "我的反馈与积分", robots: { index: false, follow: false } };
export default async function Page() { const locale = await getRequestLocale(); return <EditorialShell locale={locale}><main className="editorial-container" style={{ paddingBlock: 48 }}><PointsCenter /></main></EditorialShell>; }
