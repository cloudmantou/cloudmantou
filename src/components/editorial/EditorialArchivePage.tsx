import Link from "next/link";
import { ArrowLeft, ArrowRight, Folder, Hash, Search } from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import type { EditorialTaxonomyItem } from "@/lib/editorial-article";
import {
  EDITORIAL_SEARCH_MAX_LENGTH,
  buildEditorialArchiveHref,
  type EditorialArchiveQueryError,
} from "@/lib/editorial-archive";
import { EditorialArticleCard, type EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { EditorialOrbitArt } from "@/components/editorial/EditorialOrbitArt";
import styles from "./EditorialArchiveControls.module.css";

type Props = {
  locale: OfficialLocale;
  title: string;
  description: string;
  posts: EditorialPostCardData[];
  categories: EditorialTaxonomyItem[];
  tags: EditorialTaxonomyItem[];
  totalPosts?: number;
  resultCount?: number;
  basePath?: string;
  query?: string | null;
  queryError?: EditorialArchiveQueryError;
  currentPage?: number;
  totalPages?: number;
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
  resultCount = posts.length,
  basePath = "/blog",
  query = null,
  queryError = null,
  currentPage = 1,
  totalPages = 1,
  activeCategory,
  activeTag,
}: Props) {
  const years = groupPostsByYear(posts);
  const taxonomyKind = activeCategory ? "category" : activeTag ? "tag" : null;
  const localizedBasePath = localizeOfficialPath(basePath, locale);
  const queryErrorMessage = queryError === "empty"
    ? (locale === "en" ? "Enter a search term." : "请输入搜索关键词。")
    : queryError === "too_long"
      ? (locale === "en" ? `Search terms are limited to ${EDITORIAL_SEARCH_MAX_LENGTH} characters.` : `搜索关键词不能超过 ${EDITORIAL_SEARCH_MAX_LENGTH} 个字符。`)
      : null;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((page) => totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1);
  return (
    <>
      <section className={`editorial-archive-v2-hero${taxonomyKind ? ` editorial-taxonomy-hero editorial-taxonomy-${taxonomyKind}` : ""}`}>
        <div className="editorial-container editorial-archive-v2-hero-grid">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
            <dl>
              <div><dt>{locale === "en" ? "Categories" : "分类"}</dt><dd>{categories.length}</dd></div>
              <div><dt>{locale === "en" ? "Tags" : "标签"}</dt><dd>{tags.length}</dd></div>
              <div><dt>{locale === "en" ? "Articles" : "文章"}</dt><dd>{resultCount}</dd></div>
            </dl>
          </div>
          <EditorialOrbitArt label={locale === "en" ? "Article archive orbit" : "文章归档轨道插画"} />
        </div>
      </section>

      <section className={`editorial-section editorial-archive-taxonomy${taxonomyKind ? " editorial-taxonomy-section" : ""}`}>
        <div className="editorial-container">
          <div className="editorial-section-heading"><h2>{locale === "en" ? "Browse by category" : "按分类浏览"}</h2></div>
          <nav className="editorial-category-rail editorial-taxonomy-category-rail" aria-label={locale === "en" ? "Article categories" : "文章分类"}>
            <Link className={!activeCategory ? "is-active" : ""} href={buildEditorialArchiveHref(localizeOfficialPath("/blog", locale), { query })}><Folder size={20} />{locale === "en" ? "All" : "全部"}<small>{totalPosts ?? posts.length}</small></Link>
            {categories.map((category, index) => (
              <Link key={category.slug} className={`${activeCategory === category.slug ? "is-active" : ""} accent-${index % 3}`} href={buildEditorialArchiveHref(localizeOfficialPath(`/category/${category.slug}`, locale), { query })}>
                <Folder size={20} />{category.name}<small>{category.count ?? 0}</small>
              </Link>
            ))}
          </nav>

          <div className="editorial-section-heading editorial-tag-heading"><h2>{locale === "en" ? "Explore by tag" : "按标签探索"}</h2></div>
          <nav className="editorial-tag-orbits editorial-taxonomy-tag-rail" aria-label={locale === "en" ? "Article tags" : "文章标签"}>
            {tags.map((tag, index) => (
              <Link key={tag.slug} className={`${activeTag === tag.slug ? "is-active" : ""} orbit-${index % 4}`} href={buildEditorialArchiveHref(localizeOfficialPath(`/tag/${tag.slug}`, locale), { query })}>
                <Hash size={14} />{tag.name}<small>{tag.count ?? 0}</small>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className={`editorial-section editorial-year-archive${taxonomyKind ? " editorial-taxonomy-results" : ""}`} id="articles">
        <div className="editorial-container">
          <div className={styles.searchPanel}>
            <form className={styles.searchForm} action={localizedBasePath} method="get" role="search">
              <label className={styles.inputWrap}>
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">{locale === "en" ? "Search articles" : "搜索文章"}</span>
                <input
                  className={styles.input}
                  type="search"
                  name="q"
                  defaultValue={query ?? ""}
                  maxLength={EDITORIAL_SEARCH_MAX_LENGTH}
                  placeholder={locale === "en" ? "Search titles, summaries, and article text" : "搜索标题、摘要和正文"}
                  aria-invalid={queryError ? true : undefined}
                  aria-describedby={queryError ? "editorial-search-error" : undefined}
                />
              </label>
              <button className={styles.submit} type="submit"><Search size={17} />{locale === "en" ? "Search" : "搜索"}</button>
            </form>
            {queryErrorMessage ? <p className={styles.error} id="editorial-search-error" role="alert">{queryErrorMessage}</p> : null}
            {query ? (
              <p className={styles.summary} aria-live="polite">
                <span>{locale === "en" ? `${resultCount} results for “${query}”` : `“${query}” 共找到 ${resultCount} 篇文章`}</span>
                <Link className={styles.clear} href={localizedBasePath}>{locale === "en" ? "Clear search" : "清除搜索"}</Link>
              </p>
            ) : null}
          </div>
          {years.map(([year, yearPosts]) => (
            <section key={year} className="editorial-year-group">
              <div className="editorial-section-heading"><h2>{year}</h2><span>{locale === "en" ? `${yearPosts.length} ${yearPosts.length === 1 ? "article" : "articles"}` : `共 ${yearPosts.length} 篇`}</span></div>
              <div className="editorial-year-list">
                {yearPosts.map((post, index) => <EditorialArticleCard key={post.slug} post={post} locale={locale} variant={index === 0 ? "lead" : "row"} index={index} />)}
              </div>
            </section>
          ))}
          {years.length === 0 ? <p className="editorial-empty">{locale === "en" ? "No articles in this archive yet." : "该归档暂无文章。"}</p> : null}
          {totalPages > 1 ? (
            <nav className={styles.pagination} aria-label={locale === "en" ? "Archive pages" : "归档分页"}>
              <Link
                className={styles.pageLink}
                href={buildEditorialArchiveHref(localizedBasePath, { query, page: Math.max(1, currentPage - 1) })}
                aria-disabled={currentPage <= 1 ? true : undefined}
              ><ArrowLeft size={16} />{locale === "en" ? "Previous" : "上一页"}</Link>
              {pageNumbers.map((page) => (
                <Link
                  key={page}
                  className={styles.pageLink}
                  href={buildEditorialArchiveHref(localizedBasePath, { query, page })}
                  aria-current={page === currentPage ? "page" : undefined}
                >{page}</Link>
              ))}
              <Link
                className={styles.pageLink}
                href={buildEditorialArchiveHref(localizedBasePath, { query, page: Math.min(totalPages, currentPage + 1) })}
                aria-disabled={currentPage >= totalPages ? true : undefined}
              >{locale === "en" ? "Next" : "下一页"}<ArrowRight size={16} /></Link>
            </nav>
          ) : null}
          {basePath !== "/blog" ? <Link className="editorial-archive-more" href={buildEditorialArchiveHref(localizeOfficialPath("/blog", locale), { query })}>{locale === "en" ? "View the full archive" : "查看完整归档"}<ArrowRight size={17} /></Link> : null}
        </div>
      </section>
    </>
  );
}
