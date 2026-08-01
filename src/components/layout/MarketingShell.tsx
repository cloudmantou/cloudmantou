"use client";

import { Suspense, type ReactNode } from "react";
import { isOfficialSite } from "@/config/site";
import { OfficialShell } from "@/components/official/OfficialShell";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";

function BlogMarketingChrome({ children }: { children: ReactNode }) {
  return (
    <PlatformSidebar mode="routes" mainClassName="marketing-main">
      <div className="marketing-content-shell">{children}</div>
    </PlatformSidebar>
  );
}

function OfficialMarketingChrome({ children }: { children: ReactNode }) {
  return <OfficialShell>{children}</OfficialShell>;
}

/**
 * MarketingShell —— 营销/内容页通用骨架
 * 官网模式使用顶栏布局；博客模式保留左侧导航。
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  const Chrome = isOfficialSite ? OfficialMarketingChrome : BlogMarketingChrome;

  return (
    <Suspense fallback={null}>
      <Chrome>{children}</Chrome>
    </Suspense>
  );
}