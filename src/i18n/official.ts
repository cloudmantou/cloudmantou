export const OFFICIAL_LOCALE_COOKIE = "cloudmantou_locale";
export const MINIMUM_IOS_VERSION = "15.0";
export const VIRTUAL_LOCATION_MINIMUM_IOS_VERSION = MINIMUM_IOS_VERSION.replace(/\.0$/, "");

export type OfficialLocale = "zh" | "en";

type LocaleResolutionInput = {
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
};

export function isOfficialLocale(value: unknown): value is OfficialLocale {
  return value === "zh" || value === "en";
}

export function parseOfficialLocaleCookie(cookieHeader?: string | null): OfficialLocale | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName !== OFFICIAL_LOCALE_COOKIE) continue;
    try {
      const value = decodeURIComponent(rawValueParts.join("=")).toLowerCase();
      return isOfficialLocale(value) ? value : null;
    } catch {
      return null;
    }
  }

  return null;
}

function parseAcceptLanguage(value?: string | null): OfficialLocale | null {
  if (!value) return null;

  const candidates = value
    .split(",")
    .map((part, index) => {
      const [tagPart, ...params] = part.trim().split(";");
      const qualityParam = params.find((param) => param.trim().startsWith("q="));
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
      return {
        tag: tagPart.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((candidate) => candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const candidate of candidates) {
    if (candidate.tag === "zh" || candidate.tag.startsWith("zh-")) return "zh";
    if (candidate.tag === "en" || candidate.tag.startsWith("en-")) return "en";
  }

  return null;
}

export function resolveOfficialLocale(input: LocaleResolutionInput = {}): OfficialLocale {
  return (
    parseOfficialLocaleCookie(input.cookieHeader) ||
    parseAcceptLanguage(input.acceptLanguage) ||
    "zh"
  );
}

const OFFICIAL_PUBLIC_ROOTS = new Set([
  "",
  "features",
  "download",
  "docs",
  "pricing",
  "store",
  "blog",
  "post",
  "login",
  "register",
]);

function splitPathSuffix(value: string): { pathname: string; suffix: string } {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex === -1
    ? { pathname: value, suffix: "" }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

export function getOfficialLocaleFromPath(value: string): OfficialLocale | null {
  const { pathname } = splitPathSuffix(value);
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : null;
}

export function stripOfficialLocalePrefix(value: string): string {
  const { pathname, suffix } = splitPathSuffix(value);
  if (pathname === "/en") return `/${suffix}`;
  if (pathname.startsWith("/en/")) return `${pathname.slice(3) || "/"}${suffix}`;
  return value;
}

export function isOfficialPublicPath(value: string): boolean {
  const { pathname } = splitPathSuffix(stripOfficialLocalePrefix(value));
  if (!pathname.startsWith("/")) return false;
  const root = pathname.split("/")[1] || "";
  return OFFICIAL_PUBLIC_ROOTS.has(root);
}

export function localizeOfficialPath(value: string, locale: OfficialLocale): string {
  if (!value.startsWith("/") || value.startsWith("//") || !isOfficialPublicPath(value)) {
    return value;
  }

  const normalized = stripOfficialLocalePrefix(value);
  if (locale === "zh") return normalized;
  return normalized === "/" ? "/en" : `/en${normalized}`;
}

type OfficialRequestResolutionInput = LocaleResolutionInput & {
  pathname: string;
  method?: string | null;
};

export type OfficialRequestResolution = {
  locale: OfficialLocale | null;
  redirectPath: string | null;
  rewritePath: string | null;
  persistLocale: OfficialLocale | null;
};

export function buildOfficialRewriteUrl(requestUrl: string | URL, pathname: string): URL {
  const target = new URL(requestUrl);
  target.pathname = pathname;
  return target;
}

export function resolveRoutedOfficialRequest(
  localeHeader?: string | null,
  internalRewriteHeader?: string | null
): OfficialRequestResolution | null {
  if (internalRewriteHeader !== "1" || !isOfficialLocale(localeHeader)) return null;
  return {
    locale: localeHeader,
    redirectPath: null,
    rewritePath: null,
    persistLocale: null,
  };
}

export function resolveOfficialRequest(
  input: OfficialRequestResolutionInput
): OfficialRequestResolution {
  const method = (input.method || "GET").toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || !isOfficialPublicPath(input.pathname)) {
    return { locale: null, redirectPath: null, rewritePath: null, persistLocale: null };
  }

  if (getOfficialLocaleFromPath(input.pathname) === "en") {
    return {
      locale: "en",
      redirectPath: null,
      rewritePath: stripOfficialLocalePrefix(input.pathname),
      persistLocale: "en",
    };
  }

  const locale = resolveOfficialLocale(input);
  return locale === "en"
    ? {
        locale,
        redirectPath: localizeOfficialPath(input.pathname, locale),
        rewritePath: null,
        persistLocale: null,
      }
    : { locale, redirectPath: null, rewritePath: null, persistLocale: null };
}

const zh = {
  site: {
    name: "馒头助手",
    alternateName: "AppFlex",
    subtitle: "免费的 iOS 设备必备工具",
    description:
      `馒头助手（AppFlex）是一款免费的 iOS 设备工具，支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统，提供 App Store 应用降级、虚拟定位、IPA 签名、免 Wi-Fi 与香色闺阁安装。`,
  },
  language: {
    current: "中",
    switchTo: "EN",
    switchLabel: "Switch to English",
  },
  nav: {
    label: "主导航",
    features: "功能",
    store: "应用商店",
    download: "安装",
    docs: "教程",
    admin: "后台",
    account: "会员中心",
    login: "登录",
    buyCard: "购买卡密",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
  },
  home: {
    eyebrow: "馒头助手 · AppFlex",
    hero: {
      title: "一款免费的 iOS 设备必备工具",
      description:
        `支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统。应用降级、虚拟定位、IPA 签名与免 Wi-Fi 操作，一个工具完成。`,
      primaryAction: { label: "获取下载方式", href: "/download" },
      secondaryAction: { label: "购买卡密", href: "/pricing" },
    },
    latestPrefix: "已适配",
    latestVersion: "iOS 26.4 及以上系统",
    compatibility: {
      baseline: `iOS ${MINIMUM_IOS_VERSION}+`,
      virtualLocation: `iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION}+`,
      latest: "iOS 26.4+",
      devices: "iPhone / iPad",
      title: "广泛兼容",
      subtitle: "持续适配 iOS 新系统",
      labels: ["基础功能支持", "虚拟定位支持", "最新系统适配", "支持设备"],
    },
    features: [
      { id: "downgrade", title: "App Store 应用降级", description: "按应用选择可用历史版本，告别新版本不适配或不好用的问题。", meta: "历史版本选择" },
      { id: "location", title: "虚拟定位", description: `连接设备后模拟 GPS 坐标，支持 iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} 及以上系统。`, meta: `支持 iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} 及以上` },
      { id: "signing", title: "IPA 签名", description: "导入 IPA 文件并按引导完成签名，集中管理待安装应用。", meta: "签名与安装" },
      { id: "no-wifi", title: "免 Wi-Fi", description: "通过数据线连接设备即可操作，不依赖同一 Wi-Fi 网络。", meta: "数据线直连" },
      { id: "latest-ios", title: "iOS 26.4+ 新系统适配", description: "持续跟进新系统适配，当前支持 iOS 26.4 及以上系统。", meta: "新系统持续适配" },
      { id: "xiangse", title: "香色闺阁安装", description: "从馒头助手应用商店查找香色闺阁，并按页面指引完成安装。", meta: "应用商店直达" },
    ],
    workflow: {
      index: "02 / 使用流程",
      title: "简单三步，轻松完成",
      description: "所有操作都从真实设备连接开始，完成后在设备端核对结果。",
      steps: [
        { title: "连接设备", body: "使用数据线连接 iPhone 或 iPad，并确认设备状态。" },
        { title: "选择功能", body: "根据需要进入应用降级、定位、签名或应用商店。" },
        { title: "完成操作", body: "跟随页面提示执行，并在完成后核对设备结果。" },
      ],
    },
    xiangse: {
      index: "03 / 应用安装",
      title: "香色闺阁安装",
      description: "从馒头助手应用商店查找应用，按页面提示完成安装与结果确认。",
      action: "前往应用商店",
      steps: ["连接设备", "浏览应用", "开始安装", "完成安装"],
    },
    store: { index: "04 / 应用商店", title: "精选应用，一站安装", description: "浏览当前已上架应用；安装入口与具体要求以应用详情页为准。", action: "查看全部" },
    faq: {
      index: "05 / 帮助",
      title: "常见问题",
      description: "仍有疑问？安装方式和最新兼容说明以官网对应页面为准。",
      action: "查看使用教程",
      items: [
        { q: "馒头助手是免费工具吗？", a: "馒头助手工具本身免费。请只通过 cloudmantoua.top 官方网站获取安装方式，部分应用或服务的具体权益以对应页面说明为准。" },
        { q: "支持哪些 iOS 系统？", a: `基础功能支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统；虚拟定位支持 iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} 及以上系统；新系统适配信息以官网最新说明为准。` },
        { q: "购买卡密后可以获得什么？", a: "卡密对应的有效期、用途和可用权益以购买页中的具体商品说明为准；购买前请先核对交付类型，避免把免费工具与卡密权益混淆。" },
        { q: "免 Wi-Fi 是什么意思？", a: "设备可通过数据线与电脑端连接，不需要让电脑和 iPhone 处于同一个 Wi-Fi 网络。" },
      ],
    },
    final: {
      title: "立即获取馒头助手",
      subtitle: "免费、清晰、按官方说明安装",
      notice: "工具免费下载，卡密权益以商品说明为准。请认准 cloudmantoua.top 官方网站。",
    },
    workspace: {
      deviceOverview: "设备概览",
      appManagement: "应用管理",
      location: "虚拟定位",
      signing: "签名管理",
      myDevice: "我的 iPhone",
      connected: "已连接",
      iosVersion: "iOS 26.4 · 已通过数据线连接",
      toolsReady: "6 项常用功能已就绪",
      phoneReady: "设备已就绪",
      connectionStable: "连接稳定",
      tiles: ["应用降级", "虚拟定位", "IPA 签名", "免 Wi-Fi", "新系统适配", "香色安装"],
      tileMeta: ["历史版本", `iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION}+`, "签名安装", "数据线直连", "iOS 26.4+", "商店直达"],
    },
  },
  footer: {
    alias: "又名 AppFlex",
    product: "产品",
    resources: "资源",
    features: "功能介绍",
    store: "应用商店",
    install: "安装指南",
    pricing: "会员定价",
    docs: "使用教程",
    blog: "技术博客",
    blogSite: "博客子站",
    auth: "登录 / 注册",
  },
  contact: { copied: "已复制 {value}", copyFailed: "复制失败，请手动复制", copy: "复制{name}", copyTitle: "点击复制：{value}", close: "关闭", qrAlt: "{name}二维码", open: "打开链接" },
  pages: {
    features: {
      title: "功能介绍",
      metaDescription: "馒头助手（AppFlex）支持 App Store 应用降级、虚拟定位、IPA 签名、免 Wi-Fi、新系统适配与香色闺阁安装。",
      description: `支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统；不同能力的最低版本要求会单独标明。`,
      action: "查看安装指南",
    },
    download: {
      title: "安装指南",
      pageTitle: "获取馒头助手",
      metaDescription: `免费获取馒头助手（AppFlex）的官方安装方式；支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统。`,
      description: "工具本身免费。电脑端支持 Windows 与 macOS，请认准 cloudmantoua.top 官方网站获取安装包。",
      platformTitle: "支持 Windows 与 macOS",
      platformDescription: "先选择电脑系统下载馒头助手，再通过数据线连接 iPhone 或 iPad。",
      platforms: [
        {
          id: "windows",
          name: "Windows",
          description: "适用于 Windows 电脑的馒头助手客户端。",
          action: "下载 Windows 版",
          pending: "Windows 下载地址配置中",
        },
        {
          id: "macos",
          name: "macOS",
          description: "适用于 Mac 电脑的馒头助手客户端。",
          action: "下载 macOS 版",
          pending: "macOS 下载地址配置中",
        },
      ],
      requirementsTitle: "系统要求",
      requirements: [`基础功能支持 iOS ${MINIMUM_IOS_VERSION} 及以上系统`, `虚拟定位支持 iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} 及以上系统`, "当前已适配 iOS 26.4 及以上系统，请使用最新版电脑端工具", "可完成侧载安装的 iPhone / iPad"],
      packageTitle: "获取安装包",
      packageUnavailable: "Windows 或 macOS 下载地址配置完成后，对应下载按钮会自动显示。请只使用官网提供的安装包。",
      freeNotice: "馒头助手为免费工具；应用商店中的个别内容或附加服务如有单独权益要求，以对应页面的明确说明为准。",
      storeAction: "浏览应用商店",
      docsAction: "查看使用教程",
    },
    docs: {
      title: "使用教程",
      metaDescription: "馒头助手安装、激活、应用商店使用教程与常见问题。",
      description: "快速上手馒头助手（AppFlex）的安装、会员与应用商店使用。",
      guides: [
        { title: "安装与激活", href: "/download", desc: "从购卡到完成侧载安装的完整流程。" },
        { title: "应用商店", href: "/store", desc: "浏览并安装香色闺阁、源阅读等应用。" },
        { title: "会员定价", href: "/pricing", desc: "了解卡密有效期与购买方式。" },
        { title: "功能说明", href: "/features", desc: "虚拟定位、商店模式等能力介绍。" },
      ],
      related: "相关文章",
      allBlog: "查看全部博客",
    },
    pricing: {
      title: "会员定价",
      metaDescription: "查看馒头助手当前在售的直属会员与卡密商品；实际权益、有效期和交付方式以商品说明为准。",
      description: "直属会员支付完成后自动生效；卡密商品会交付独立的卡号与卡密。有效期、用途与交付方式以每个商品说明为准。",
      noticeTitle: "购买前请确认交付类型",
      noticeBody: "直属会员无需兑换；卡密商品需在会员中心同时输入卡号与卡密。并非所有卡密商品都会授予会员或 Store 安装权限。",
      loading: "正在加载商品…",
      empty: "暂无在售商品，请稍后再来。",
      loadError: "商品加载失败",
      orderError: "下单失败",
    },
    store: {
      title: "应用商店",
      metaDescription: "浏览馒头助手 iOS 应用目录；具有有效会员权限且应用已配置正式安装地址时可发起安装。",
      description: "浏览已上架应用；有效会员仅可安装已配置正式安装地址的应用。",
      filters: { all: "全部", reading: "阅读", tool: "工具", entertainment: "娱乐", other: "其他" },
      featured: "精选",
      searchLabel: "搜索应用",
      searchPlaceholder: "搜索应用…",
      empty: "暂无匹配的应用。",
    },
    storeDetail: {
      notFound: "应用不存在",
      installSuffix: "安装",
      featured: "精选",
      accessValid: "会员权限有效",
      installReady: "此应用已配置正式安装入口。点击后将交由对应 App 或系统安装服务处理。",
      openInstall: "打开安装入口",
      installMissing: "此应用尚未配置正式安装地址，目前不可发起安装。本站不会提供占位或猜测链接。",
      accessRequired: "需要有效会员权限；安装是否可用还取决于此应用是否已配置正式安装地址。",
      viewMembership: "查看会员商品",
      back: "返回商店",
    },
    blog: {
      title: "技术博客",
      metaDescription: "馒头助手与 iOS 侧载、应用安装相关教程与技术文章。",
      description: "教程、技巧与产品更新。主站聚焦产品转化，博客承载长尾 SEO 内容。",
      empty: "暂无已发布文章。",
    },
  },
  product: {
    viewDetails: "查看 {name} 详情",
    stock: "库存 {count}",
    introduction: "查看介绍",
    buyNow: "立即购买",
    loginToBuy: "登录购买",
    details: "{name} 详情",
    close: "关闭",
    usage: "使用方式",
    unavailable: "暂未开放",
    categories: { membership: "会员套餐", paidPost: "付费内容", card: "卡密商品", service: "增值服务" },
  },
  payment: {
    checkout: "收银台",
    close: "关闭",
    scenes: { pc: "电脑网站支付 / 微信扫码", wechat: "微信内 · 仅支持支付宝", h5: "手机 H5 支付" },
    orderNo: "订单号 {orderNo}",
    desktop: "电脑",
    mobileH5: "手机 H5",
    wechatInApp: "微信内",
    qrAlt: "微信支付二维码",
    qrPrompt: "请使用微信扫一扫完成支付",
    waiting: "等待支付结果…",
    alipay: "支付宝",
    wechatPay: "微信支付",
    desktopWeb: "电脑网站",
    h5: "H5",
    unavailable: "不可用",
    scan: "扫码",
    wechatUnavailableTitle: "微信内需 JSAPI，请使用支付宝",
    startFailed: "发起支付失败",
    simulateFailed: "模拟支付失败",
    unknownResponse: "未知支付响应",
    failed: "支付失败",
    result: {
      deliveryPending: "支付已确认，正在发放卡密，请勿关闭页面…",
      confirmingProvider: "正在向支付宝确认支付结果，本地测试无公网回调时会自动查单…",
      delayed: "若支付宝已扣款但状态未更新，请稍后刷新或联系管理员手动查单。",
      confirming: "正在确认支付结果",
      success: "支付成功",
      redirecting: "正在跳转到会员中心订单页…",
      viewOrders: "查看我的订单",
      processing: "支付处理中",
      pendingFallback: "若已完成支付，请稍候或返回首页查看会员状态。",
      queryFailed: "无法查询订单",
      home: "返回首页",
    },
  },
  auth: {
    login: "登录",
    register: "注册",
    usernameOrEmail: "用户名或邮箱",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    loggingIn: "登录中...",
    noAccount: "还没有账号？",
    registerNow: "立即注册",
    loginFailed: "登录失败，请稍后重试",
    credentialsInvalid: "用户名或密码错误",
    email: "邮箱",
    emailPlaceholder: "请输入邮箱",
    username: "用户名",
    usernamePlaceholder: "2-20个字符",
    nickname: "昵称（可选）",
    nicknamePlaceholder: "默认使用用户名",
    newPasswordPlaceholder: "至少6个字符",
    confirmPassword: "确认密码",
    confirmPasswordPlaceholder: "再次输入密码",
    registering: "注册中...",
    hasAccount: "已有账号？",
    loginNow: "立即登录",
    passwordMismatch: "两次密码输入不一致",
    registerFailed: "注册失败，请稍后重试",
  },
} as const;

const en = {
  site: {
    name: "Mantou Assistant",
    alternateName: "AppFlex",
    subtitle: "A free essential toolkit for iOS devices",
    description: `Mantou Assistant (AppFlex) is a free iOS device toolkit for iOS ${MINIMUM_IOS_VERSION} or later, with App Store downgrades, virtual location, IPA signing, no-Wi-Fi operation, and Xiangse Reader installation.`,
  },
  language: { current: "EN", switchTo: "中", switchLabel: "切换到中文" },
  nav: {
    label: "Primary navigation",
    features: "Features",
    store: "App Store",
    download: "Install",
    docs: "Guides",
    admin: "Admin",
    account: "Account",
    login: "Sign in",
    buyCard: "Buy a card key",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  home: {
    eyebrow: "Mantou Assistant · AppFlex",
    hero: {
      title: "A free essential toolkit for iOS devices",
      description: `Built for iOS ${MINIMUM_IOS_VERSION} or later. Downgrade apps, simulate location, sign IPA files, and work without Wi-Fi in one toolkit.`,
      primaryAction: { label: "Get download options", href: "/download" },
      secondaryAction: { label: "Buy a card key", href: "/pricing" },
    },
    latestPrefix: "Ready for",
    latestVersion: "iOS 26.4 or later",
    compatibility: {
      baseline: `iOS ${MINIMUM_IOS_VERSION}+`,
      virtualLocation: `iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION}+`,
      latest: "iOS 26.4+",
      devices: "iPhone / iPad",
      title: "Broad compatibility",
      subtitle: "Continuously updated for new iOS releases",
      labels: ["Core features", "Virtual location", "Latest iOS support", "Devices"],
    },
    features: [
      { id: "downgrade", title: "App Store downgrades", description: "Choose an available earlier version when the latest release is incompatible or no longer works for you.", meta: "Version history" },
      { id: "location", title: "Virtual location", description: `Simulate GPS coordinates after connecting your device. Supports iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} or later.`, meta: `iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} or later` },
      { id: "signing", title: "IPA signing", description: "Import IPA files, follow the signing flow, and manage apps waiting to be installed.", meta: "Sign and install" },
      { id: "no-wifi", title: "No Wi-Fi required", description: "Operate over a wired device connection without sharing the same Wi-Fi network.", meta: "Wired connection" },
      { id: "latest-ios", title: "iOS 26.4+ support", description: "Ongoing compatibility work for new system releases, currently including iOS 26.4 or later.", meta: "Continuous updates" },
      { id: "xiangse", title: "Install Xiangse Reader", description: "Find Xiangse Reader in the Mantou Assistant app catalog and follow the guided installation flow.", meta: "Open in catalog" },
    ],
    workflow: {
      index: "02 / WORKFLOW",
      title: "Three simple steps",
      description: "Every action starts with a real device connection and ends with a result check on the device.",
      steps: [
        { title: "Connect", body: "Connect your iPhone or iPad with a cable and confirm the device status." },
        { title: "Choose a tool", body: "Open app downgrade, location, signing, or the app catalog." },
        { title: "Finish", body: "Follow the on-screen steps, then confirm the result on your device." },
      ],
    },
    xiangse: {
      index: "03 / APP INSTALL",
      title: "Install Xiangse Reader",
      description: "Find the app in the Mantou Assistant catalog and follow the guided install and verification steps.",
      action: "Open app catalog",
      steps: ["Connect device", "Browse apps", "Start install", "Verify install"],
    },
    store: { index: "04 / APP CATALOG", title: "Curated apps, one guided flow", description: "Browse published apps. Installation availability and requirements are shown on each app page.", action: "View all" },
    faq: {
      index: "05 / HELP",
      title: "Frequently asked questions",
      description: "Still unsure? Check the official install page and latest compatibility notes.",
      action: "View guides",
      items: [
        { q: "Is Mantou Assistant free?", a: "The Mantou Assistant toolkit is free. Get installation options only from cloudmantoua.top. Specific apps or services may have separate benefits described on their own pages." },
        { q: "Which iOS versions are supported?", a: `Core features require iOS ${MINIMUM_IOS_VERSION} or later. Virtual location requires iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} or later. Check the official site for the latest compatibility details.` },
        { q: "What do I receive after buying a card key?", a: "Validity, purpose, and benefits depend on the product description. Check the delivery type before purchasing so card benefits are not confused with the free toolkit." },
        { q: "What does no Wi-Fi mean?", a: "Your device can connect to the desktop tool by cable, without placing the computer and iPhone on the same Wi-Fi network." },
      ],
    },
    final: {
      title: "Get Mantou Assistant",
      subtitle: "Free, transparent, and installed from official instructions",
      notice: "The toolkit is free. Card-key benefits follow each product description. Use cloudmantoua.top as the official source.",
    },
    workspace: {
      deviceOverview: "Device overview",
      appManagement: "Apps",
      location: "Location",
      signing: "Signing",
      myDevice: "My iPhone",
      connected: "Connected",
      iosVersion: "iOS 26.4 · Connected by cable",
      toolsReady: "6 device tools ready",
      phoneReady: "Device ready",
      connectionStable: "Stable connection",
      tiles: ["Downgrade", "Location", "IPA signing", "No Wi-Fi", "New iOS", "Xiangse"],
      tileMeta: ["Version history", `iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION}+`, "Sign & install", "Wired link", "iOS 26.4+", "App catalog"],
    },
  },
  footer: {
    alias: "Also known as AppFlex",
    product: "Product",
    resources: "Resources",
    features: "Features",
    store: "App catalog",
    install: "Installation",
    pricing: "Pricing",
    docs: "Guides",
    blog: "Technical blog",
    blogSite: "Blog site",
    auth: "Sign in / Register",
  },
  contact: { copied: "Copied {value}", copyFailed: "Copy failed. Please copy it manually.", copy: "Copy {name}", copyTitle: "Click to copy: {value}", close: "Close", qrAlt: "{name} QR code", open: "Open link" },
  pages: {
    features: {
      title: "Features",
      metaDescription: "Mantou Assistant (AppFlex) supports App Store downgrades, virtual location, IPA signing, no-Wi-Fi workflows, new iOS releases, and Xiangse Reader installation.",
      description: `Supports iOS ${MINIMUM_IOS_VERSION} or later. Features with a higher minimum version are labeled separately.`,
      action: "View installation guide",
    },
    download: {
      title: "Installation",
      pageTitle: "Get Mantou Assistant",
      metaDescription: `Get official installation options for Mantou Assistant (AppFlex), supporting iOS ${MINIMUM_IOS_VERSION} or later.`,
      description: "The toolkit is free and available for Windows and macOS. Get the installer only from cloudmantoua.top.",
      platformTitle: "Available for Windows and macOS",
      platformDescription: "Choose your computer platform first, then connect your iPhone or iPad with a cable.",
      platforms: [
        {
          id: "windows",
          name: "Windows",
          description: "Mantou Assistant for Windows computers.",
          action: "Download for Windows",
          pending: "Windows download is being configured",
        },
        {
          id: "macos",
          name: "macOS",
          description: "Mantou Assistant for Mac computers.",
          action: "Download for macOS",
          pending: "macOS download is being configured",
        },
      ],
      requirementsTitle: "System requirements",
      requirements: [`Core features require iOS ${MINIMUM_IOS_VERSION} or later`, `Virtual location requires iOS ${VIRTUAL_LOCATION_MINIMUM_IOS_VERSION} or later`, "The current desktop release supports iOS 26.4 or later", "An iPhone or iPad that supports sideloading"],
      packageTitle: "Get the installer",
      packageUnavailable: "The matching button appears when the Windows or macOS download URL is configured. Use only installers published on the official site.",
      freeNotice: "Mantou Assistant is free. Individual catalog items or additional services may have separate benefits stated on their own pages.",
      storeAction: "Browse app catalog",
      docsAction: "View guides",
    },
    docs: {
      title: "Guides",
      metaDescription: "Installation, activation, app catalog guides, and FAQs for Mantou Assistant.",
      description: "Get started with installation, membership, and the Mantou Assistant app catalog.",
      guides: [
        { title: "Install and activate", href: "/download", desc: "The full flow from card purchase to sideloaded installation." },
        { title: "App catalog", href: "/store", desc: "Browse and install Xiangse Reader, Source Reader, and other apps." },
        { title: "Pricing", href: "/pricing", desc: "Understand card validity and purchase options." },
        { title: "Feature guide", href: "/features", desc: "Learn about virtual location, catalog mode, and other tools." },
      ],
      related: "Related articles",
      allBlog: "View all posts",
    },
    pricing: {
      title: "Pricing",
      metaDescription: "View current Mantou Assistant memberships and card-key products. Benefits, validity, and delivery follow each product description.",
      description: "Direct memberships activate after payment. Card-key products deliver a separate card number and secret. Validity, purpose, and delivery follow each product description.",
      noticeTitle: "Check the delivery type before buying",
      noticeBody: "Direct memberships do not require redemption. Card-key products require both the card number and secret in the account center. Not every card product grants membership or app-install access.",
      loading: "Loading products…",
      empty: "No products are currently available.",
      loadError: "Unable to load products",
      orderError: "Unable to create order",
    },
    store: {
      title: "App catalog",
      metaDescription: "Browse the Mantou Assistant iOS app catalog. Members can install apps that have an official installation URL.",
      description: "Browse published apps. Active members can install only apps with a configured official installation URL.",
      filters: { all: "All", reading: "Reading", tool: "Tools", entertainment: "Entertainment", other: "Other" },
      featured: "Featured",
      searchLabel: "Search apps",
      searchPlaceholder: "Search apps…",
      empty: "No matching apps.",
    },
    storeDetail: {
      notFound: "App not found",
      installSuffix: "Install",
      featured: "Featured",
      accessValid: "Membership active",
      installReady: "This app has an official installation URL. Opening it will hand off to the relevant app or system installation service.",
      openInstall: "Open installer",
      installMissing: "This app does not yet have an official installation URL, so installation is unavailable. We do not provide placeholder or guessed links.",
      accessRequired: "An active membership is required. Installation also depends on whether this app has an official installation URL.",
      viewMembership: "View membership products",
      back: "Back to catalog",
    },
    blog: {
      title: "Technical blog",
      metaDescription: "Mantou Assistant articles about iOS sideloading, app installation, and product updates.",
      description: "Guides, tips, and product updates for Mantou Assistant.",
      empty: "No published articles yet.",
    },
  },
  product: {
    viewDetails: "View {name} details",
    stock: "Stock {count}",
    introduction: "Overview",
    buyNow: "Buy now",
    loginToBuy: "Sign in to buy",
    details: "{name} details",
    close: "Close",
    usage: "How to use",
    unavailable: "Unavailable",
    categories: { membership: "Membership", paidPost: "Paid content", card: "Card key", service: "Service" },
  },
  payment: {
    checkout: "Checkout",
    close: "Close",
    scenes: { pc: "Desktop payment / WeChat QR", wechat: "Inside WeChat · Alipay only", h5: "Mobile H5 payment" },
    orderNo: "Order {orderNo}",
    desktop: "Desktop",
    mobileH5: "Mobile H5",
    wechatInApp: "In WeChat",
    qrAlt: "WeChat Pay QR code",
    qrPrompt: "Scan with WeChat to complete payment",
    waiting: "Waiting for payment…",
    alipay: "Alipay",
    wechatPay: "WeChat Pay",
    desktopWeb: "Desktop web",
    h5: "H5",
    unavailable: "Unavailable",
    scan: "Scan",
    wechatUnavailableTitle: "WeChat JSAPI is required in-app. Please use Alipay.",
    startFailed: "Unable to start payment",
    simulateFailed: "Unable to simulate payment",
    unknownResponse: "Unknown payment response",
    failed: "Payment failed",
    result: {
      deliveryPending: "Payment confirmed. Your card key is being delivered; keep this page open…",
      confirmingProvider: "Confirming the payment with Alipay…",
      delayed: "If Alipay charged you but the status has not updated, refresh later or contact support.",
      confirming: "Confirming payment",
      success: "Payment successful",
      redirecting: "Taking you to your orders…",
      viewOrders: "View my orders",
      processing: "Payment processing",
      pendingFallback: "If you have completed payment, wait a moment or return home to check membership status.",
      queryFailed: "Unable to find this order",
      home: "Return home",
    },
  },
  auth: {
    login: "Sign in",
    register: "Create account",
    usernameOrEmail: "Username or email",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    loggingIn: "Signing in...",
    noAccount: "New here?",
    registerNow: "Create an account",
    loginFailed: "Sign-in failed. Please try again.",
    credentialsInvalid: "Incorrect username or password",
    email: "Email",
    emailPlaceholder: "Enter your email",
    username: "Username",
    usernamePlaceholder: "2–20 characters",
    nickname: "Display name (optional)",
    nicknamePlaceholder: "Defaults to your username",
    newPasswordPlaceholder: "At least 6 characters",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Enter your password again",
    registering: "Creating account...",
    hasAccount: "Already have an account?",
    loginNow: "Sign in",
    passwordMismatch: "Passwords do not match",
    registerFailed: "Registration failed. Please try again.",
  },
} as const;

export const OFFICIAL_MESSAGES = { zh, en } as const;
export type OfficialMessages = (typeof OFFICIAL_MESSAGES)[OfficialLocale];

export function getOfficialMessages(locale: OfficialLocale): OfficialMessages {
  return OFFICIAL_MESSAGES[locale];
}

export function interpolateMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
