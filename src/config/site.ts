export const DEFAULT_SITE_URL = "https://cloudmantoua.top";
export const DEFAULT_BLOG_SITE_URL = "https://blog.cloudmantoua.top";

export type SiteMode = "blog" | "official";

/** official-site 分支默认 official；博客部署时设 NEXT_PUBLIC_SITE_MODE=blog */
export const SITE_MODE: SiteMode =
  process.env.NEXT_PUBLIC_SITE_MODE === "blog" ? "blog" : "official";

export const isOfficialSite = SITE_MODE === "official";

// —— 博客版默认文案（main 分支 / SITE_MODE=blog）——
export const BLOG_BRAND_NAME = "馒头的博客";
export const BLOG_SUBTITLE = "记录开发、运维与独立产品实践";
export const BLOG_DESCRIPTION =
  "馒头的个人技术博客，记录开发、运维、独立产品与内容变现实践。";

// —— 官网版默认文案（official-site 分支 / SITE_MODE=official）——
export const OFFICIAL_BRAND_NAME = "馒头助手";
export const OFFICIAL_ALTERNATE_NAME = "AppFlex";
export const OFFICIAL_SUBTITLE = "免费的 iOS 设备必备工具";
export const OFFICIAL_DESCRIPTION =
  `馒头助手（AppFlex）是一款免费的 iOS 设备工具，支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统，提供 App Store 应用降级、虚拟定位、IPA 签名、免 Wi-Fi 与香色闺阁安装。`;

export const TOOL_NAME = "馒头助手";

export const BRAND_NAME = isOfficialSite ? OFFICIAL_BRAND_NAME : BLOG_BRAND_NAME;
export const DEFAULT_SITE_SUBTITLE = isOfficialSite ? OFFICIAL_SUBTITLE : BLOG_SUBTITLE;
export const DEFAULT_SITE_DESCRIPTION = isOfficialSite ? OFFICIAL_DESCRIPTION : BLOG_DESCRIPTION;

export const siteConfig = {
  mode: SITE_MODE,
  name: BRAND_NAME,
  owner: "Mantou",
  toolName: TOOL_NAME,
  alternateName: isOfficialSite ? OFFICIAL_ALTERNATE_NAME : undefined,
  subtitle: DEFAULT_SITE_SUBTITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  url: DEFAULT_SITE_URL,
  blogUrl: DEFAULT_BLOG_SITE_URL,
  nav: isOfficialSite
      ? [
        { label: "功能", value: "features", href: "/features" },
        { label: "应用商店", value: "store", href: "/store" },
        { label: "安装", value: "download", href: "/download" },
        { label: "教程", value: "docs", href: "/docs" },
      ]
    : [
        { label: "首页", value: "home" },
        { label: "技术博客", value: "blog" },
        { label: "会员与卡密", value: "shop" },
        { label: "运营记录", value: "daily" },
      ],
} as const;
import { MINIMUM_IOS_VERSION } from "@/i18n/official";
