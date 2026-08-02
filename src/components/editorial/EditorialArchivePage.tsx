import Link from "next/link";
import { ArrowRight, Folder, Hash } from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import type { EditorialTaxonomyItem } from "@/lib/editorial-article";
import { EditorialArticleCard, type EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { EditorialOrbitArt } from "@/components/editorial/EditorialOrbitArt";

type Props = {
  locale: OfficialLocale;
  title: string;
  description: string;
  posts: EditorialPostCardData[];
  categories: EditorialTaxonomyItem[];
  tags: EditorialTaxonomyItem[];
  totalPosts?: number;
  activeCategory?: string;
  activeTag?: string;
};

function groupPostsByYear(posts: EditorialPostCardData[]) {
  const groups = new Map<string, EditorialPostCardData[]>();
  posts.forEach((post) => {
    const year = post.publishedAt ? String(post.publishedAt.getFullYear()) : "—";
    groups.set(year, [...(groups.get(year) ?? []), post]);
  });
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function EditorialArchivePage({
  locale,
  title,
  description,
  posts,
  categories,
  tags,
  totalPosts,
  activeCategory,
  activeTag,
}: Props) {
  const years = groupPostsByYear(posts);
  return (
    <>
      <section className="editorial-archive-v2-hero">
        <div className="editorial-container editorial-archive-v2-hero-grid">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
            <dl>
              <div><dt>{locale === "en" ? "Categories" : "分类"}</dt><dd>{categories.length}</dd></div>
              <div><dt>{locale === "en" ? "Tags" : "标签"}</dt><dd>{tags.length}</dd></div>
              <div><dt>{locale === "en" ? "Articles" : "文章"}</dt><dd>{posts.length}</dd></div>
            </dl>
          </div>
          <EditorialOrbitArt label={locale === "en" ? "Article archive orbit" : "文章归档轨道插画"} />
        </div>
      </section>

      <section className="editorial-section editorial-archive-taxonomy">
        <div className="editorial-container">
          <div className="editorial-section-heading"><h2>{locale === "en" ? "Browse by category" : "按分类浏览"}</h2></div>
          <nav className="editorial-category-rail" aria-label={locale === "en" ? "Article categories" : "文章分类"}>
            <Link className={!activeCategory ? "is-active" : ""} href={localizeOfficialPath("/blog", locale)}><Folder size={20} />{locale === "en" ? "All" : "全部"}<small>{totalPosts ?? posts.length}</small></Link>
            {categories.map((category, index) => (
              <Link key={category.slug} className={`${activeCategory === category.slug ? "is-active" : ""} accent-${index % 3}`} href={localizeOfficialPath(`/category/${category.slug}`, locale)}>
                <Folder size={20} />{category.name}<small>{category.count ?? 0}</small>
              </Link>
            ))}
          </nav>

          <div className="editorial-section-heading editorial-tag-heading"><h2>{locale === "en" ? "Explore by tag" : "按标签探索"}</h2></div>
          <nav className="editorial-tag-orbits" aria-label={locale === "en" ? "Article tags" : "文章标签"}>
            {tags.map((tag, index) => (
              <Link key={tag.slug} className={`${activeTag === tag.slug ? "is-active" : ""} orbit-${index % 4}`} href={localizeOfficialPath(`/tag/${tag.slug}`, locale)}>
                <Hash size={14} />{tag.name}<small>{tag.count ?? 0}</small>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="editorial-section editorial-year-archive">
        <div className="editorial-container">
          {years.map(([year, yearPosts]) => (
            <section key={year} className="editorial-year-group">
              <div className="editorial-section-heading"><h2>{year}</h2><span>{locale === "en" ? `${yearPosts.length} ${yearPosts.length === 1 ? "article" : "articles"}` : `共 ${yearPosts.length} 篇`}</span></div>
              <div className="editorial-year-list">
                {yearPosts.map((post, index) => <EditorialArticleCard key={post.slug} post={post} locale={locale} variant={index === 0 ? "lead" : "row"} index={index} />)}
              </div>
            </section>
          ))}
          {years.length === 0 ? <p className="editorial-empty">{locale === "en" ? "No articles in this archive yet." : "该归档暂无文章。"}</p> : null}
          <Link className="editorial-archive-more" href={localizeOfficialPath("/blog", locale)}>{locale === "en" ? "View the full archive" : "查看完整归档"}<ArrowRight size={17} /></Link>
        </div>
      </section>
    </>
  );
}
