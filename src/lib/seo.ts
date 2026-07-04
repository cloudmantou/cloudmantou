import type { Metadata } from "next";
import {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
  TOOL_NAME,
} from "@/config/site";
import { getSiteSettings } from "@/lib/site-settings";

export {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_SUBTITLE,
  DEFAULT_SITE_URL,
};

export const DEFAULT_KEYWORDS = [
  "技术博客",
  "个人博客",
  "独立开发",
  "运维",
  "Next.js",
  "cloudmantoua.top",
  "馒头",
  "馒头助手",
  "iOS安装",
  "香色闺阁",
  "源阅读",
  "会员内容",
  "卡密",
] as const;

export type SeoContext = {
  name: string;
  subtitle: string;
  description: string;
  url: string;
};

export function resolveSiteUrl(settingsUrl?: string): string {
  const fromSettings = settingsUrl?.trim();
  if (fromSettings) return fromSettings.replace(/\/$/, "");

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  return DEFAULT_SITE_URL;
}

export async function getSeoContext(): Promise<SeoContext> {
  const settings = await getSiteSettings();
  return {
    name: settings.siteName?.trim() || BRAND_NAME,
    subtitle: settings.siteSubtitle?.trim() || DEFAULT_SITE_SUBTITLE,
    description: settings.siteDescription?.trim() || DEFAULT_SITE_DESCRIPTION,
    url: resolveSiteUrl(settings.siteUrl),
  };
}

export function buildRootMetadata(ctx: SeoContext): Metadata {
  const title = `${ctx.name} — ${ctx.subtitle}`;
  return {
    metadataBase: new URL(ctx.url),
    title: {
      default: title,
      template: `%s | ${ctx.name}`,
    },
    description: ctx.description,
    keywords: [...DEFAULT_KEYWORDS],
    alternates: {
      canonical: ctx.url,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: ctx.url,
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
    path?: string;
    type?: "website" | "article";
    image?: string | null;
  }
): Metadata {
  const description = options.description || ctx.description;
  const canonical = options.path ? `${ctx.url}${options.path}` : undefined;

  return {
    title: options.title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: options.type || "website",
      locale: "zh_CN",
      url: canonical,
      siteName: ctx.name,
      title: options.title,
      description,
      ...(options.image ? { images: [{ url: options.image }] } : {}),
    },
    twitter: {
      card: options.image ? "summary_large_image" : "summary",
      title: options.title,
      description,
    },
  };
}

export function buildWebSiteJsonLd(ctx: SeoContext) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ctx.name,
    alternateName: ["cloudmantoua.top", TOOL_NAME],
    url: ctx.url,
    description: ctx.description,
    inLanguage: "zh-CN",
    publisher: {
      "@type": "Person",
      name: "Mantou",
    },
  };
}

export function buildSoftwareApplicationJsonLd(ctx: SeoContext) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: TOOL_NAME,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "iOS",
    description:
      "作者自研的 iOS 应用安装工具，支持香色闺阁、源阅读等阅读类应用的安装与分发。",
    url: ctx.url,
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
    url: `${ctx.url}/?section=blog`,
    description: "个人技术博客，记录开发、运维与独立产品实践。",
    inLanguage: "zh-CN",
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
    coverImage: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
    authorName: string;
  }
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || ctx.description,
    url: `${ctx.url}/post/${post.slug}`,
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
    ...(post.coverImage ? { image: [post.coverImage] } : {}),
    inLanguage: "zh-CN",
    mainEntityOfPage: `${ctx.url}/post/${post.slug}`,
  };
}