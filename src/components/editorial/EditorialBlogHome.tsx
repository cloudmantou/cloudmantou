import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Code2, Coffee, Compass, Layers3, Rocket, ShieldCheck, Wallet } from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import {
  MANTOU_ASSISTANT_ARTICLE,
  MANTOU_ASSISTANT_ARTICLE_EN,
  getEditorialBlogCopy,
  getEditorialJourney,
  getEditorialProjects,
} from "@/config/editorial-blog";
import { EditorialArticleCard, type EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { selectEditorialHomepagePosts } from "@/lib/editorial-featured";

function getMantouAssistantPost(posts: EditorialPostCardData[], locale: OfficialLocale): EditorialPostCardData {
  const article = locale === "en" ? MANTOU_ASSISTANT_ARTICLE_EN : MANTOU_ASSISTANT_ARTICLE;
  return posts.find((post) => post.slug === article.slug) || {
    ...article,
    publishedAt: new Date("2026-08-02T00:00:00+08:00"),
    status: "PUBLISHED",
    isTop: false,
    category: { name: article.category },
    author: { username: "mantou", nickname: locale === "en" ? "Mantou" : "馒头" },
  };
}

const PROJECT_ICONS = [Code2, BookOpen, Wallet, Layers3, Rocket] as const;

export function EditorialBlogHome({
  posts,
  locale,
  allowStaticFallback = true,
}: {
  posts: EditorialPostCardData[];
  locale: OfficialLocale;
  allowStaticFallback?: boolean;
}) {
  const copy = getEditorialBlogCopy(locale);
  const projects = getEditorialProjects(locale);
  const journey = getEditorialJourney(locale);
  const homepagePosts = posts.length > 0
    ? posts
    : allowStaticFallback
      ? [getMantouAssistantPost(posts, locale)]
      : [];
  const { featuredPosts, recentPosts } = selectEditorialHomepagePosts(homepagePosts);
  const primaryRecent = recentPosts[0];
  const compactRecent = recentPosts.slice(1);

  return (
    <EditorialShell locale={locale}>
      <section className="editorial-hero">
        <div className="editorial-container editorial-hero-grid">
          <div className="editorial-hero-copy">
            <h1>{copy.hero.title}</h1>
            <p>{copy.hero.description}</p>
            <div className="editorial-actions">
              <Link className="editorial-button editorial-button-blue" href={localizeOfficialPath(copy.hero.primaryAction.href, locale)}>
                {copy.hero.primaryAction.label}<ArrowRight size={19} />
              </Link>
              <Link className="editorial-button editorial-button-paper" href={localizeOfficialPath(copy.hero.secondaryAction.href, locale)}>
                {copy.hero.secondaryAction.label}
              </Link>
            </div>
          </div>
          <div className="editorial-hero-visual">
            <div className="editorial-hero-image">
              <Image src={copy.hero.asset} alt="" fill sizes="(max-width: 760px) 92vw, 38vw" priority />
            </div>
            <aside className="editorial-profile-card">
              <span className="editorial-profile-avatar">M</span>
              <strong>{copy.profile.name}</strong>
              <em>{copy.profile.role}</em>
              <p>{copy.profile.description}</p>
              <span className="editorial-profile-lines">
                <span><Code2 size={16} />{locale === "en" ? "Independent development" : "独立开发"}</span>
                <span><Rocket size={16} />{locale === "en" ? "Product practice" : "产品实践"}</span>
                <span><ShieldCheck size={16} />{locale === "en" ? "Verified notes" : "真实复盘"}</span>
              </span>
            </aside>
          </div>
        </div>
      </section>

      <section className="editorial-feature-section" aria-labelledby="featured-articles-title">
        <div className="editorial-container">
          <div className="editorial-feature-heading">
            <span>{copy.sections.featuredEyebrow}</span>
            <h2 id="featured-articles-title">{copy.sections.featured}</h2>
            <Link href={localizeOfficialPath("/blog", locale)}>
              {copy.sections.allArticles}<ArrowRight size={18} />
            </Link>
          </div>
          <div className={`editorial-feature-grid editorial-feature-count-${featuredPosts.length}`}>
            {featuredPosts.map((post, index) => (
              <EditorialArticleCard
                key={post.slug}
                post={post}
                locale={locale}
                variant={index === 0 ? "featured-lead" : "featured-card"}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="editorial-section" id="articles">
        <div className="editorial-container">
          <div className="editorial-section-heading">
            <h2>{copy.sections.latest}</h2>
            <Link href={localizeOfficialPath("/blog", locale)}>{copy.sections.allArticles}<ArrowRight size={18} /></Link>
          </div>
          {primaryRecent ? (
            <div className="editorial-latest-grid">
              <EditorialArticleCard post={primaryRecent} locale={locale} variant="lead" index={0} />
              <div className="editorial-compact-grid">
                {compactRecent.map((post, index) => (
                  <EditorialArticleCard key={post.slug} post={post} locale={locale} variant="card" index={index + 1} />
                ))}
              </div>
            </div>
          ) : (
            <p className="editorial-empty">{locale === "en" ? "More field notes are on the way." : "更多实践文章正在整理中。"}</p>
          )}
        </div>
      </section>

      <section className="editorial-section editorial-project-section" id="projects">
        <div className="editorial-container">
          <div className="editorial-section-heading"><h2>{copy.sections.projects}</h2></div>
          <div className="editorial-project-rail">
            {projects.map((project, index) => {
              const Icon = PROJECT_ICONS[index % PROJECT_ICONS.length];
              return (
                <Link key={project.name} href={localizeOfficialPath(project.href, locale)} className={`editorial-project-card is-${project.accent}`}>
                  <span className="editorial-project-icon"><Icon size={30} /></span>
                  <span><strong>{project.name}</strong><small>{project.description}</small></span>
                  <ArrowUpRight size={22} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="editorial-section editorial-support-section">
        <div className="editorial-container editorial-support-panel">
          <span className="editorial-support-mark" aria-hidden="true">♥</span>
          <div><h2>{copy.support.title}</h2><p>{copy.support.description}</p></div>
          <div className="editorial-support-actions">
            <Link className="editorial-button editorial-button-red" href={localizeOfficialPath(copy.support.primaryAction.href, locale)}>{copy.support.primaryAction.label}<ArrowRight size={18} /></Link>
            <Link className="editorial-button editorial-button-paper" href={localizeOfficialPath(copy.support.secondaryAction.href, locale)}>{copy.support.secondaryAction.label}</Link>
          </div>
        </div>
      </section>

      <section className="editorial-section editorial-journey-section" id="journey" aria-labelledby="journey-section-title">
        <div className="editorial-container">
          <div className="editorial-journey-header">
            <span className="editorial-public-kicker">{journey.eyebrow}</span>
            <h2 id="journey-section-title">{journey.title}</h2>
            <p>{journey.subtitle}</p>
          </div>

          <div className="editorial-journey-grid">
            <div className="editorial-journey-card editorial-journey-dev">
              <div className="editorial-journey-card-head">
                <span className="editorial-journey-badge is-blue"><Compass size={20} /></span>
                <h3>{journey.devTitle}</h3>
              </div>
              <ol className="editorial-journey-timeline">
                {journey.devItems.map((item) => (
                  <li key={item.period}>
                    <span>{item.period}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="editorial-journey-card editorial-journey-life">
              <div className="editorial-journey-card-head">
                <span className="editorial-journey-badge is-yellow"><Coffee size={20} /></span>
                <h3>{journey.lifeTitle}</h3>
              </div>
              <p className="editorial-journey-lead">{journey.lifeLead}</p>
              <ul className="editorial-journey-life-list">
                {journey.lifeHighlights.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ul>
              <div className="editorial-journey-actions">
                <Link className="editorial-button editorial-button-blue" href={localizeOfficialPath(journey.dailyLinkHref, locale)}>
                  {journey.dailyLinkLabel}<ArrowRight size={17} />
                </Link>
                <Link className="editorial-button editorial-button-paper" href={localizeOfficialPath(journey.aboutLinkHref, locale)}>
                  {journey.aboutLinkLabel}<ArrowUpRight size={17} />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="editorial-section editorial-about-section" id="about">
        <div className="editorial-container editorial-about-panel">
          <span className="editorial-profile-avatar">M</span>
          <div><h2>{copy.about.title}</h2><p>{copy.about.description}</p></div>
          <Link href={localizeOfficialPath("/blog", locale)}>{copy.sections.allArticles}<ArrowUpRight size={20} /></Link>
        </div>
      </section>
    </EditorialShell>
  );
}
