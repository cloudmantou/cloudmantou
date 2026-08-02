"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Eye,
  FileText,
  MessageCircle,
} from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import type { AdjacentArticle, EditorialHeading } from "@/lib/editorial-article";
import { EditorialOrbitArt } from "@/components/editorial/EditorialOrbitArt";
import { isSafeCoverImageUrl } from "@/lib/safe-image-url";

export type EditorialArticleChromeProps = {
  locale: OfficialLocale;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage?: string | null;
  publishedAt: string | null;
  updatedAt?: string | null;
  authorName: string;
  category: { name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  headings: EditorialHeading[];
  wordCount: number;
  readTime: string;
  viewCount?: number;
  commentCount?: number;
  previousPost?: AdjacentArticle | null;
  nextPost?: AdjacentArticle | null;
  children: ReactNode;
  engagement?: ReactNode;
  recommendationHref?: string;
  recommendationLabel?: string;
};

function formatDate(value: string | null | undefined, locale: OfficialLocale): string {
  if (!value) return locale === "en" ? "Continuously updated" : "持续更新";
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function EditorialToc({ headings, locale, permalink }: { headings: EditorialHeading[]; locale: OfficialLocale; permalink: string }) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (headings.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-120px 0px -68%", threshold: [0, 1] }
    );
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [headings]);

  const copyPermalink = async () => {
    const canonicalUrl = new URL(permalink, window.location.origin).toString();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(canonicalUrl);
      setCopyState("copied");
    } catch {
      let copied = false;
      const input = document.createElement("textarea");
      try {
        input.value = canonicalUrl;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        input.remove();
      }
      setCopyState(copied ? "copied" : "error");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <aside className="article-toc" aria-label={locale === "en" ? "Table of contents" : "文章目录"}>
      <strong>{locale === "en" ? "Contents" : "目录"}</strong>
      <nav>
        {headings.map((heading) => (
          <a
            key={heading.id}
            className={`${heading.level === 3 ? "is-child" : ""}${activeId === heading.id ? " is-active" : ""}`}
            href={`#${heading.id}`}
            aria-current={activeId === heading.id ? "location" : undefined}
          >
            {heading.text}
          </a>
        ))}
      </nav>
      <div className="article-permalink">
        <FileText size={17} aria-hidden="true" />
        <span><b>{locale === "en" ? "Permalink" : "永久链接"}</b><small>{permalink}</small></span>
        <button type="button" onClick={copyPermalink} aria-label={locale === "en" ? "Copy permalink" : "复制永久链接"}>
          {copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === "copied"
            ? locale === "en" ? "Permalink copied" : "永久链接已复制"
            : copyState === "error"
              ? locale === "en" ? "Copy failed" : "复制失败"
              : ""}
        </span>
      </div>
    </aside>
  );
}

export function EditorialArticleChrome(props: EditorialArticleChromeProps) {
  const {
    locale,
    slug,
    title,
    excerpt,
    coverImage,
    publishedAt,
    updatedAt,
    authorName,
    category,
    tags,
    headings,
    wordCount,
    readTime,
    viewCount,
    commentCount,
    previousPost,
    nextPost,
    children,
    engagement,
    recommendationHref = "/pricing",
    recommendationLabel,
  } = props;
  const permalink = localizeOfficialPath(`/post/${slug}`, locale);
  const publishedLabel = formatDate(publishedAt, locale);
  const updatedLabel = formatDate(updatedAt || publishedAt, locale);
  const safeCoverImage = coverImage?.trim() && isSafeCoverImageUrl(coverImage) ? coverImage.trim() : null;

  return (
    <article className="editorial-reading-page">
      <header className="editorial-article-hero">
        <div className="editorial-article-hero-copy">
          {category ? (
            <Link href={localizeOfficialPath(`/category/${category.slug}`, locale)}>{category.name}</Link>
          ) : null}
          <h1>{title}</h1>
          {excerpt ? <p>{excerpt}</p> : null}
          <div className="editorial-article-stats">
            <span><CalendarDays size={17} />{publishedLabel}</span>
            <span className="article-word-count"><FileText size={17} />{locale === "en" ? `${wordCount.toLocaleString("en-US")} words` : `${wordCount.toLocaleString("zh-CN")} 字`}</span>
            <span><Clock3 size={17} />{readTime}</span>
            {typeof viewCount === "number" ? <span><Eye size={17} />{viewCount}</span> : null}
            {typeof commentCount === "number" ? <span><MessageCircle size={17} />{commentCount}</span> : null}
          </div>
          <div className="editorial-article-author-chip"><span>M</span><b>{authorName}</b></div>
        </div>
        <div className={`editorial-article-cover-frame${safeCoverImage ? " has-cover" : ""}`}>
          {safeCoverImage ? (
            <span
              className="editorial-article-cover-image"
              style={{ backgroundImage: `url(${JSON.stringify(safeCoverImage)})` }}
              role="img"
              aria-label={locale === "en" ? `Cover image for ${title}` : `${title}的封面图`}
            />
          ) : null}
          <EditorialOrbitArt label={locale === "en" ? "Editorial black hole and orbit illustration" : "黑洞与轨道编辑插画"} />
        </div>
      </header>

      <div className="editorial-reading-layout">
        <EditorialToc headings={headings} locale={locale} permalink={permalink} />
        <div className="editorial-reading-main">
          <section className="editorial-article-notice" aria-label={locale === "en" ? "Content notice" : "内容说明"}>
            <span>i</span>
            <div><strong>{locale === "en" ? "Content note" : "内容说明"}</strong><p>{locale === "en" ? "This article documents personal development and product practice. Verify time-sensitive details against the current product page and applicable service terms." : "本文记录个人开发与产品实践。涉及版本、功能和服务条款的时效信息，请以当前产品页面与实际验证结果为准。"}</p></div>
          </section>

          <div className="editorial-reading-content">{children}</div>

          <section className="editorial-article-recommendation">
            <span>♥</span>
            <div><strong>{locale === "en" ? "Support independent work" : "支持独立创作"}</strong><p>{locale === "en" ? "Membership and card-key services help keep product development and field notes moving." : "会员和卡密服务用于支持产品维护、内容更新与后续技术实践。"}</p></div>
            <Link href={localizeOfficialPath(recommendationHref, locale)}>{recommendationLabel || (locale === "en" ? "View support options" : "查看支持方式")}<ArrowRight size={17} /></Link>
          </section>

          <div className="editorial-article-taxonomy">
            {category ? <Link href={localizeOfficialPath(`/category/${category.slug}`, locale)}>{category.name}</Link> : null}
            {tags.map((tag) => <Link key={tag.id} href={localizeOfficialPath(`/tag/${tag.slug}`, locale)}>#{tag.name}</Link>)}
          </div>

          <section className="article-author-license">
            <span className="editorial-profile-avatar">M</span>
            <div><strong>{authorName}</strong><small>{locale === "en" ? `Published ${publishedLabel} · Updated ${updatedLabel}` : `发布于 ${publishedLabel} · 更新于 ${updatedLabel}`}</small></div>
            <div><b>CC BY-NC-SA 4.0</b><small>{locale === "en" ? "Attribution · NonCommercial · ShareAlike" : "署名 · 非商业性使用 · 相同方式共享"}</small></div>
            <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">{locale === "en" ? "License" : "许可协议"}<ArrowRight size={15} /></a>
          </section>

          <nav className="article-adjacent-navigation" aria-label={locale === "en" ? "Adjacent articles" : "相邻文章"}>
            {previousPost ? <Link href={localizeOfficialPath(`/post/${previousPost.slug}`, locale)}><ArrowLeft size={20} /><span><small>{locale === "en" ? "Previous" : "上一篇"}</small><b>{previousPost.title}</b></span></Link> : <span className="is-empty" />}
            {nextPost ? <Link href={localizeOfficialPath(`/post/${nextPost.slug}`, locale)}><span><small>{locale === "en" ? "Next" : "下一篇"}</small><b>{nextPost.title}</b></span><ArrowRight size={20} /></Link> : <span className="is-empty" />}
          </nav>

          {engagement}
        </div>
      </div>

      <button className="article-back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={locale === "en" ? "Back to top" : "返回顶部"}>
        <ArrowUp size={22} />
      </button>
    </article>
  );
}
