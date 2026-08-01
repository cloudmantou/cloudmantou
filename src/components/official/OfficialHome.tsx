import {
  FaqSection,
  FinalDownloadSection,
  FeatureGridSection,
  HeroSection,
  XiangseInstallSection,
} from "@/components/official/sections";
import { OfficialShell } from "@/components/official/OfficialShell";

export function OfficialHome() {
  return (
    <OfficialShell>
      <HeroSection />
      <FeatureGridSection />
      <XiangseInstallSection />
      <FaqSection />
      <FinalDownloadSection />
    </OfficialShell>
  );
}
