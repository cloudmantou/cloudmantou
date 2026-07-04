"use client";

import { Suspense, type ReactNode } from "react";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";

function MarketingChrome({ children }: { children: ReactNode }) {
  return (
    <PlatformSidebar mode="routes" mainClassName="marketing-main">
      <div className="marketing-content-shell">{children}</div>
    </PlatformSidebar>
  );
}

/**
 * MarketingShell —— 营销/内容页通用骨架
 *
 * 与 PlatformShell 共用左侧导航，用于：
 *   - /post/[slug]  文章详情
 *   - /category/[slug]  分类列表
 *   - /dashboard  会员中心
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <MarketingChrome>{children}</MarketingChrome>
    </Suspense>
  );
}