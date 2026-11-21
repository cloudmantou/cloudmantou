import type { Metadata } from "next";
import { HongjianAppPage } from "@/components/hongjian/HongjianAppPage";
import { buildHongjianMetadata } from "@/components/hongjian/metadata";

export const metadata: Metadata = buildHongjianMetadata("privacy");

export default function HongjianPrivacyPage() {
  return <HongjianAppPage page="privacy" />;
}
