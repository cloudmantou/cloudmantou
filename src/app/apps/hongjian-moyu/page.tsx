import type { Metadata } from "next";
import { HongjianAppPage } from "@/components/hongjian/HongjianAppPage";
import { buildHongjianMetadata } from "@/components/hongjian/metadata";

export const metadata: Metadata = buildHongjianMetadata("home");

export default function HongjianHomePage() {
  return <HongjianAppPage page="home" />;
}
