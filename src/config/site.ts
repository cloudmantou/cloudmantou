export const DEFAULT_SITE_URL = "https://cloudmantoua.top";
export const BRAND_NAME = "馒头的博客";
export const TOOL_NAME = "馒头助手";
export const DEFAULT_SITE_SUBTITLE = "记录开发、运维与独立产品实践";
export const DEFAULT_SITE_DESCRIPTION =
  "馒头的个人技术博客，记录开发、运维、独立产品与内容变现实践。本站也运营自研工具馒头助手（iOS 应用安装）及会员、卡密服务。";

export const siteConfig = {
  name: BRAND_NAME,
  owner: "Mantou",
  toolName: TOOL_NAME,
  subtitle: DEFAULT_SITE_SUBTITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  nav: [
    { label: "首页", value: "home" },
    { label: "技术博客", value: "blog" },
    { label: "会员与卡密", value: "shop" },
    { label: "运营记录", value: "daily" },
  ],
} as const;
