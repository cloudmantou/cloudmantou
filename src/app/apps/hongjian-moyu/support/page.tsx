import type { Metadata } from "next";
import { HongjianAppPage } from "@/components/hongjian/HongjianAppPage";
import { buildHongjianMetadata } from "@/components/hongjian/metadata";

export const metadata: Metadata = buildHongjianMetadata("support");

export default function HongjianSupportPage() {
  return <HongjianAppPage page="support" />;
}
