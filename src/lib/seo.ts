import type { Metadata } from "next";
import {
  BRAND_NAME,
  DEFAULT_BLOG_SITE_URL,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
  OFFICIAL_ALTERNATE_NAME,
  TOOL_NAME,
  isOfficialSite,
} from "@/config/site";
import { getSiteSettings } from "@/lib/site-settings";
import {
  getOfficialMessages,
  localizeOfficialPath,
  MINIMUM_IOS_VERSION,
  type OfficialLocale,
} from "@/i18n/official";
import { getEditorialBlogCopy } from "@/config/editorial-blog";

export {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
};

export const BLOG_KEYWORDS = [
  "技术博客",
  "个人博客",
  "独立开发",
  "运维",
  "Next.js",
  "馒头",
  "馒头助手",
] as const;

const OFFICIAL_KEYWORDS = [
  "馒头助手",
  "AppFlex",
  "iOS应用安装",
  "iOS安装",
  "虚拟定位",
  "香色闺阁",
  "香色闺阁安装",
  "源阅读",
  "源阅读安装",
  "应用商店",
  "巨魔商店",
  "cloudmantoua.top",
  "卡密",
  "会员",
] as const;

export const DEFAULT_KEYWORDS = isOfficialSite ? OFFICIAL_KEYWORDS : BLOG_KEYWORDS;

export type SeoContext = {
  name: string;
  subtitle: string;
  description: string;
  url: string;
  locale: OfficialLocale;
};

export function withEditorialSeoContext(ctx: SeoContext): SeoContext {
  const copy = getEditorialBlogCopy(ctx.locale);
  return {
    ...ctx,
    name: copy.brand.name,
    subtitle: copy.brand.subtitle,
    description: copy.hero.description,
  };
}

export function resolveSiteUrl(settingsUrl?: string): string {
  const fromSettings = settingsUrl?.trim();
  if (fromSettings) return fromSettings.replace(/\/$/, "");

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  return isOfficialSite ? DEFAULT_SITE_URL : DEFAULT_BLOG_SITE_URL;
}

export async function getSeoContext(locale: OfficialLocale = "zh"): Promise<SeoContext> {
  const settings = await getSiteSettings().catch((error: unknown) => {
    const cause = error instanceof Error ? error.name : "UnknownError";
    console.warn(`[SEO] Runtime site settings unavailable; using defaults (${cause})`);
    return null;
  });
  const officialCopy = getOfficialMessages(locale).site;
  return {
    name: isOfficialSite ? officialCopy.name : settings?.siteName?.trim() || BRAND_NAME,
    subtitle: isOfficialSite
      ? officialCopy.subtitle
      : settings?.siteSubtitle?.trim() || DEFAULT_SITE_SUBTITLE,
    description: isOfficialSite
      ? officialCopy.description
      : settings?.siteDescription?.trim() || DEFAULT_SITE_DESCRIPTION,
    url: resolveSiteUrl(settings?.siteUrl),
    locale,
  };
}

function localizedUrl(ctx: SeoContext, path: string): string {
  if (!isOfficialSite) return path === "/" ? ctx.url : `${ctx.url}${path}`;
  const localizedPath = localizeOfficialPath(path, ctx.locale);
  return localizedPath === "/" ? ctx.url : `${ctx.url}${localizedPath}`;
}

function languageAlternates(ctx: SeoContext, path: string) {
  const zhPath = localizeOfficialPath(path, "zh");
  const enPath = localizeOfficialPath(path, "en");
  const zhUrl = zhPath === "/" ? ctx.url : `${ctx.url}${zhPath}`;
  return {
    "zh-CN": zhUrl,
    "en-US": `${ctx.url}${enPath}`,
    "x-default": zhUrl,
  };
}

export function buildRootMetadata(
  ctx: SeoContext,
  options: { keywords?: readonly string[] } = {}
): Metadata {
  const title = `${ctx.name} — ${ctx.subtitle}`;
  const canonical = localizedUrl(ctx, "/");
  return {
    metadataBase: new URL(ctx.url),
    title: {
      default: title,
      template: `%s | ${ctx.name}`,
    },
    description: ctx.description,
    keywords: [...(options.keywords || DEFAULT_KEYWORDS)],
    alternates: isOfficialSite
      ? { canonical, languages: languageAlternates(ctx, "/") }
      : { canonical },
    openGraph: {
      type: "website",
      locale: ctx.locale === "en" ? "en_US" : "zh_CN",
      url: canonical,
      siteName: ctx.name,
      title,
      description: ctx.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ctx.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildPageMetadata(
  ctx: SeoContext,
  options: {
    title: string;
    description?: string;
    keywords?: readonly string[];
    socialTitle?: string;
    socialDescription?: string;
    path?: string;
    type?: "website" | "article";
    image?: string | null;
    translated?: boolean;
  }
): Metadata {
  const description = options.description || ctx.description;
  const socialTitle = options.socialTitle || options.title;
  const socialDescription = options.socialDescription || description;
  const canonical = options.path ? localizedUrl(ctx, options.path) : undefined;

  return {
    title: options.title,
    description,
    ...(options.keywords?.length ? { keywords: [...options.keywords] } : {}),
    alternates: canonical
      ? isOfficialSite
        ? options.translated === false
          ? { canonical }
          : { canonical, languages: languageAlternates(ctx, options.path || "/") }
        : { canonical }
      : undefined,
    openGraph: {
      type: options.type || "website",
      locale: ctx.locale === "en" ? "en_US" : "zh_CN",
      url: canonical,
      siteName: ctx.name,
      title: socialTitle,
      description: socialDescription,
      ...(options.image ? { images: [{ url: options.image }] } : {}),
    },
    twitter: {
      card: options.image ? "summary_large_image" : "summary",
      title: socialTitle,
      description: socialDescription,
    },
  };
}

export function buildWebSiteJsonLd(ctx: SeoContext) {
  const alternateNames = isOfficialSite
    ? [OFFICIAL_ALTERNATE_NAME, "cloudmantoua.top"]
    : ["cloudmantoua.top", TOOL_NAME];

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ctx.name,
    alternateName: alternateNames,
    url: localizedUrl(ctx, "/"),
    description: ctx.description,
    inLanguage: ctx.locale === "en" ? "en-US" : "zh-CN",
    publisher: {
      "@type": "Organization",
      name: isOfficialSite ? (ctx.locale === "en" ? ctx.name : TOOL_NAME) : "Mantou",
    },
  };
}

export function buildSoftwareApplicationJsonLd(ctx: SeoContext) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: ctx.name,
    alternateName: OFFICIAL_ALTERNATE_NAME,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "iOS",
    softwareRequirements: `iOS ${MINIMUM_IOS_VERSION} or later`,
    inLanguage: ctx.locale === "en" ? "en-US" : "zh-CN",
    description: ctx.description,
    url: localizedUrl(ctx, "/download"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
  };
}

export function buildBlogJsonLd(ctx: SeoContext) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: ctx.name,
    url: localizedUrl(ctx, "/blog"),
    description: ctx.description,
    inLanguage: ctx.locale === "en" ? "en-US" : "zh-CN",
    publisher: {
      "@type": "Person",
      name: "Mantou",
    },
  };
}

export function buildBlogPostingJsonLd(
  ctx: SeoContext,
  post: {
    title: string;
    slug: string;
    excerpt: string | null;
    seoDescription?: string | null;
    seoKeywords?: readonly string[];
    categoryName?: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
    authorName: string;
  }
) {
  const image = post.coverImage?.startsWith("/")
    ? `${ctx.url}${post.coverImage}`
    : post.coverImage;
  const articleUrl = localizedUrl(ctx, `/post/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt || ctx.description,
    url: articleUrl,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: post.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: ctx.name,
      url: ctx.url,
    },
    ...(image ? { image: [image] } : {}),
    ...(post.seoKeywords?.length ? { keywords: [...post.seoKeywords] } : {}),
    ...(post.categoryName ? { articleSection: post.categoryName } : {}),
    inLanguage: ctx.locale === "en" ? "en-US" : "zh-CN",
    mainEntityOfPage: articleUrl,
  };
}
