import mantouAssistantArticle from "@/content/mantou-assistant-article.json";

export const MANTOU_ASSISTANT_ARTICLE = {
  ...mantouAssistantArticle,
  category: "产品实践",
} as const;

export const MANTOU_ASSISTANT_ARTICLE_EN = {
  slug: MANTOU_ASSISTANT_ARTICLE.slug,
  title: mantouAssistantArticle.titleEn,
  excerpt: mantouAssistantArticle.excerptEn,
  content: mantouAssistantArticle.contentEn,
  publishedAt: MANTOU_ASSISTANT_ARTICLE.publishedAt,
  coverImage: MANTOU_ASSISTANT_ARTICLE.coverImage,
  category: "Product practice",
} as const;

export const EDITORIAL_BLOG = {
  brand: {
    name: "馒头",
    alternateName: "Mantou",
    subtitle: "技术与产品的独立笔记",
  },
  nav: [
    { label: "首页", href: "/" },
    { label: "文章", href: "/blog" },
    { label: "项目", href: "/#projects" },
    { label: "支持", href: "/pricing" },
    { label: "关于", href: "/#about" },
  ],
  hero: {
    title: "把开发、产品与独立实践，写成能复用的经验。",
    description: "记录真实项目、部署过程与踩坑复盘。少一点包装，多一点可验证的结果。",
    primaryAction: { label: "开始阅读", href: "/blog" },
    secondaryAction: { label: "了解作者", href: "/#about" },
    asset: "/editorial/editorial-workbook.webp",
  },
  profile: {
    name: "馒头 / Mantou",
    role: "独立开发者 · 产品实践者",
    description: "持续构建有用的工具，也把过程、方法和问题如实记录下来。",
  },
  sections: {
    latest: "最近文章",
    projects: "项目与实验",
    allArticles: "查看全部文章",
  },
  support: {
    title: "支持与服务",
    description: "支付与会员系统继续保留，用于付费文章、卡密产品与后续服务。博客阅读与项目记录仍是首页的主角。",
    primaryAction: { label: "查看会员与卡密", href: "/pricing" },
    secondaryAction: { label: "登录账户", href: "/login" },
  },
  about: {
    title: "关于馒头",
    description: "关注独立开发、iOS 工具、全栈工程与产品化实践。这里不堆概念，只记录亲手做过、实际验证过的事情。",
  },
} as const;

export const EDITORIAL_PROJECTS = [
  {
    name: "馒头助手",
    description: "iOS 设备工具与兼容性实践。",
    href: `/post/${MANTOU_ASSISTANT_ARTICLE.slug}`,
    accent: "blue",
    article: MANTOU_ASSISTANT_ARTICLE,
  },
  {
    name: "CloudMantou",
    description: "博客、会员、支付与内容后台的一体化实践。",
    href: "/blog",
    accent: "red",
  },
  {
    name: "部署实验室",
    description: "Node.js、Next.js、反向代理与发布流程复盘。",
    href: "/category/devops",
    accent: "yellow",
  },
] as const;

export const EDITORIAL_PROJECTS_EN = [
  {
    name: "Mantou Assistant",
    description: "iOS device tooling and compatibility practice.",
    href: `/post/${MANTOU_ASSISTANT_ARTICLE_EN.slug}`,
    accent: "blue",
    article: MANTOU_ASSISTANT_ARTICLE_EN,
  },
  {
    name: "CloudMantou",
    description: "A unified blog, membership, payment, and content platform.",
    href: "/blog",
    accent: "red",
  },
  {
    name: "Deployment Lab",
    description: "Notes on Node.js, Next.js, reverse proxies, and release workflows.",
    href: "/category/devops",
    accent: "yellow",
  },
] as const;

export const EDITORIAL_BLOG_EN = {
  ...EDITORIAL_BLOG,
  brand: {
    name: "Mantou",
    alternateName: "馒头",
    subtitle: "Independent notes on technology and products",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Articles", href: "/blog" },
    { label: "Projects", href: "/#projects" },
    { label: "Support", href: "/pricing" },
    { label: "About", href: "/#about" },
  ],
  hero: {
    ...EDITORIAL_BLOG.hero,
    title: "Turning development, products, and independent practice into reusable experience.",
    description: "Real projects, deployment notes, and honest retrospectives—with less packaging and more verifiable results.",
    primaryAction: { label: "Start reading", href: "/blog" },
    secondaryAction: { label: "About the author", href: "/#about" },
  },
  profile: {
    name: "Mantou / 馒头",
    role: "Independent developer · Product builder",
    description: "Building useful tools and documenting the process, methods, and problems without hiding the rough edges.",
  },
  sections: {
    latest: "Latest articles",
    projects: "Projects & experiments",
    allArticles: "View all articles",
  },
  support: {
    title: "Support & services",
    description: "The payment and membership system remains available for premium articles, card-key products, and future services—without taking over the blog.",
    primaryAction: { label: "View membership & cards", href: "/pricing" },
    secondaryAction: { label: "Sign in", href: "/login" },
  },
  about: {
    title: "About Mantou",
    description: "Notes on independent development, iOS tooling, full-stack engineering, and product practice. Only work that was built and verified in the real world.",
  },
} as const;

export function getEditorialBlogCopy(locale: "zh" | "en") {
  return locale === "en" ? EDITORIAL_BLOG_EN : EDITORIAL_BLOG;
}

export function getEditorialProjects(locale: "zh" | "en") {
  return locale === "en" ? EDITORIAL_PROJECTS_EN : EDITORIAL_PROJECTS;
}
