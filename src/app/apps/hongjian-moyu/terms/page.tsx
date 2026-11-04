import type { Metadata } from "next";
import { HongjianAppPage } from "@/components/hongjian/HongjianAppPage";
import { buildHongjianMetadata } from "@/components/hongjian/metadata";

export const metadata: Metadata = buildHongjianMetadata("terms");

export default function HongjianTermsPage() {
  return <HongjianAppPage page="terms" />;
}
