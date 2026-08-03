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
    { label: "关于", href: "/about" },
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
    href: "/blog#articles",
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
    href: "/blog#articles",
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
    { label: "About", href: "/about" },
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

export type EditorialPublicInfoKey = "about" | "privacy" | "disclaimer" | "contact";

type EditorialPublicInfo = {
  eyebrow: string;
  title: string;
  description: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
};

const EDITORIAL_PUBLIC_INFO = {
  zh: {
    about: {
      eyebrow: "ABOUT / 01",
      title: "关于馒头",
      description: "一个围绕工具、产品与独立实践持续更新的个人项目站。",
      sections: [
        { title: "写什么", body: "这里记录实际构建过的工具、上线过程、技术选择与产品复盘；内容会标注仍需验证的边界，而不是把推测包装成结论。" },
        { title: "如何工作", body: "项目先在真实环境中验证，再把可复用的过程整理为文章、说明或产品更新。" },
        { title: "服务边界", body: "会员、付费文章与卡密服务用于支持持续维护。权益、价格与可用性以当前产品页面和订单记录为准。" },
      ],
    },
    privacy: {
      eyebrow: "PRIVACY / 02",
      title: "隐私说明",
      description: "仅处理提供服务、账户安全与订单履约所需的信息。",
      sections: [
        { title: "收集范围", body: "账户认证、订单、支付状态、内容互动和必要的运行日志用于提供对应功能、处理履约和排查故障。" },
        { title: "支付信息", body: "支付请求由支付服务商处理。本站不会在页面中展示或要求提供支付服务商的敏感凭据。" },
        { title: "使用与保留", body: "信息仅用于产品运营、安全防护、订单交付和法律义务范围内的必要处理；账户相关记录按服务需要保留。" },
        { title: "你的选择", body: "你可以在账户中心查看与管理可见的订单和权益；如需处理隐私相关请求，请通过站点公开的联系渠道说明需求。" },
      ],
    },
    disclaimer: {
      eyebrow: "DISCLAIMER / 03",
      title: "使用声明",
      description: "工具、文章和示例以当前页面说明为准，使用前请核对环境与版本。",
      sections: [
        { title: "信息时效", body: "系统版本、第三方服务、产品特性和兼容性会变化。文章中的时间敏感内容不构成持续有效的承诺。" },
        { title: "设备与数据", body: "操作设备前请自行备份重要数据，并确认你对设备、账户和内容拥有相应使用权。" },
        { title: "虚拟定位", body: "虚拟定位仅限个人测试、开发与合法的模拟场景。请勿用于绕过平台规则、误导他人或影响任何现实服务。" },
        { title: "系统支持", body: "当前公开支持基线为 iOS 15.0 及以上；不同设备、系统版本和服务状态可能导致实际体验不同。" },
      ],
    },
    contact: {
      eyebrow: "CONTACT / 04",
      title: "联系与反馈",
      description: "欢迎提交产品反馈、内容勘误与合作建议。",
      sections: [
        { title: "适合联系的事项", body: "功能问题、兼容性信息、文章错误、订单交付疑问，以及与独立产品实践相关的合作建议。" },
        { title: "请提供的信息", body: "描述复现步骤、设备与系统版本、发生时间和已尝试的处理方式。请不要发送密码、令牌或完整支付凭据。" },
        { title: "响应范围", body: "优先处理安全、订单履约和可复现的产品问题；非公开的账户或订单信息仅会在必要核验后处理。" },
      ],
    },
  },
  en: {
    about: {
      eyebrow: "ABOUT / 01",
      title: "About Mantou",
      description: "A personal project site for tools, products, and independent practice.",
      sections: [
        { title: "What is documented", body: "The site records tools that were built, launch work, technical choices, and product retrospectives. Boundaries that still need verification stay explicit." },
        { title: "How work is shared", body: "Projects are checked in real environments before reusable notes, guides, or product updates are published." },
        { title: "Service boundary", body: "Memberships, premium articles, and card-key services support ongoing maintenance. Availability, pricing, and benefits follow the current product page and order record." },
      ],
    },
    privacy: {
      eyebrow: "PRIVACY / 02",
      title: "Privacy notice",
      description: "Only information needed for service delivery, account security, and order fulfilment is processed.",
      sections: [
        { title: "What is collected", body: "Account authentication, orders, payment status, content interactions, and essential operational logs support the corresponding features, fulfilment, and incident diagnosis." },
        { title: "Payment information", body: "Payment requests are processed by payment providers. The site does not display or ask for sensitive provider credentials in its pages." },
        { title: "Use and retention", body: "Information is used only as needed for product operations, security, fulfilment, and applicable obligations. Account records are retained for the service need." },
        { title: "Your choices", body: "Visible orders and benefits can be reviewed in the account centre. Privacy requests can be described through the site’s public contact channels." },
      ],
    },
    disclaimer: {
      eyebrow: "DISCLAIMER / 03",
      title: "Use notice",
      description: "Tools, articles, and examples follow the current page documentation; verify your environment and version before use.",
      sections: [
        { title: "Time-sensitive information", body: "System versions, third-party services, product behaviour, and compatibility change. Time-sensitive article details are not a continuing promise." },
        { title: "Devices and data", body: "Back up important data before operating a device, and confirm that you have the appropriate right to use the device, account, and content." },
        { title: "Virtual location", body: "Virtual location is limited to personal testing, development, and lawful simulation. Do not use it to evade platform rules, mislead others, or affect real-world services." },
        { title: "System support", body: "The public baseline is iOS 15.0 and later. Actual experience may vary by device, system version, and service status." },
      ],
    },
    contact: {
      eyebrow: "CONTACT / 04",
      title: "Contact and feedback",
      description: "Product feedback, corrections, and collaboration proposals are welcome.",
      sections: [
        { title: "Useful topics", body: "Feature issues, compatibility information, article corrections, order-delivery questions, and proposals related to independent product practice." },
        { title: "What to include", body: "Share reproducible steps, device and system version, time of occurrence, and what you have tried. Do not send passwords, tokens, or complete payment credentials." },
        { title: "Response scope", body: "Security, fulfilment, and reproducible product issues are prioritised. Non-public account or order details are handled only after necessary verification." },
      ],
    },
  },
} as const satisfies Record<"zh" | "en", Record<EditorialPublicInfoKey, EditorialPublicInfo>>;

export function getEditorialPublicInfo(locale: "zh" | "en", key: EditorialPublicInfoKey) {
  return EDITORIAL_PUBLIC_INFO[locale][key];
}
