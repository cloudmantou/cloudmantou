"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, Search, UserRound, X } from "lucide-react";
import { isAdminRole } from "@/lib/roles";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import { getEditorialBlogCopy } from "@/config/editorial-blog";
import { buildEditorialArchiveHref } from "@/lib/editorial-archive";

type SearchResult = { id: string; title: string; slug: string; excerpt: string | null };

export function EditorialHeader({ locale }: { locale: OfficialLocale }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { switching, setLocale } = useOfficialI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLFormElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const copy = getEditorialBlogCopy(locale);
  const isAdmin = isAdminRole(session?.user?.role);
  const accountHref = session
    ? (isAdmin ? "/admin" : localizeOfficialPath("/dashboard", locale))
    : localizeOfficialPath("/login", locale);
  const accountLabel = session
    ? (locale === "en" ? (isAdmin ? "Admin" : "Account") : (isAdmin ? "后台" : "账户"))
    : (locale === "en" ? "Sign in" : "登录");

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };
  const closeSearch = (restoreFocus = false) => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    if (restoreFocus) window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };
  const openSearch = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : searchButtonRef.current;
    setMenuOpen(false);
    setSearchOpen(true);
  };

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (searchOpen) closeSearch(true);
      else closeMenu(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        searchPanelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/posts?q=${encodeURIComponent(query.trim())}&pageSize=6&locale=${locale}`, { signal: controller.signal });
        const body = await response.json();
        if (!controller.signal.aborted) setResults(Array.isArray(body.data) ? body.data : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locale, query, searchOpen]);

  const openResult = (slug: string) => {
    closeSearch(false);
    router.push(localizeOfficialPath(`/post/${slug}`, locale));
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    closeSearch(false);
    router.push(
      buildEditorialArchiveHref(localizeOfficialPath("/blog", locale), {
        query: normalized,
      })
    );
  };

  return (
    <header className="editorial-header">
      <div className="editorial-container editorial-header-inner">
        <Link className="editorial-brand" href={localizeOfficialPath("/", locale)} onClick={() => closeMenu(false)}>
          <span className="editorial-brand-mark" aria-hidden="true">馒</span>
          <span><strong>{copy.brand.name}</strong><small>/ {copy.brand.alternateName}</small></span>
          <em>{copy.brand.subtitle}</em>
        </Link>

        <nav className="editorial-nav" aria-label={locale === "en" ? "Primary navigation" : "主导航"}>
          {copy.nav.map((item) => <Link key={item.href} href={localizeOfficialPath(item.href, locale)}>{item.label}</Link>)}
        </nav>

        <div className="editorial-header-actions">
          <button ref={searchButtonRef} type="button" className="editorial-header-icon" onClick={openSearch} aria-label={locale === "en" ? "Search articles" : "搜索文章"}>
            <Search size={18} aria-hidden="true" />
          </button>
          <Link className="editorial-account-link" href={accountHref}><UserRound size={16} aria-hidden="true" />{accountLabel}</Link>
          <button type="button" className="editorial-language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} disabled={switching} aria-label={locale === "en" ? "切换至中文" : "Switch to English"}>
            {locale === "zh" ? "EN" : "中"}
          </button>
          <button ref={menuButtonRef} type="button" className="editorial-menu-button" aria-label={menuOpen ? (locale === "en" ? "Close menu" : "关闭菜单") : (locale === "en" ? "Open menu" : "打开菜单")} aria-expanded={menuOpen} aria-controls="editorial-mobile-navigation" onClick={() => setMenuOpen((current) => !current)}>
            {menuOpen ? <X size={24} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      <nav id="editorial-mobile-navigation" className={`editorial-mobile-nav${menuOpen ? " is-open" : ""}`} aria-label={locale === "en" ? "Mobile navigation" : "移动导航"}>
        {copy.nav.map((item) => <Link key={item.href} href={localizeOfficialPath(item.href, locale)} onClick={() => closeMenu(false)}>{item.label}</Link>)}
        <button type="button" className="editorial-mobile-search" onClick={openSearch}><Search size={17} aria-hidden="true" />{locale === "en" ? "Search articles" : "搜索文章"}</button>
        <Link href={accountHref} onClick={() => closeMenu(false)}>{accountLabel}</Link>
        <button type="button" className="editorial-mobile-language" disabled={switching} onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>{locale === "zh" ? "English" : "中文"}</button>
      </nav>

      {searchOpen ? (
        <div className="editorial-search" role="dialog" aria-modal="true" aria-labelledby="editorial-search-title">
          <button type="button" className="editorial-search-backdrop" onClick={() => closeSearch(true)} aria-label={locale === "en" ? "Close search" : "关闭搜索"} />
          <form ref={searchPanelRef} className="editorial-search-panel" onSubmit={submitSearch}>
            <div className="editorial-search-heading"><h2 id="editorial-search-title">{locale === "en" ? "Search articles" : "搜索文章"}</h2><button type="button" onClick={() => closeSearch(true)} aria-label={locale === "en" ? "Close search" : "关闭搜索"}><X size={19} /></button></div>
            <label className="editorial-search-input"><Search size={18} aria-hidden="true" /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "Search titles and excerpts" : "搜索标题与摘要"} /></label>
            <div className="editorial-search-results" aria-live="polite">
              {searching ? <p>{locale === "en" ? "Searching…" : "搜索中…"}</p> : null}
              {!searching && query.trim() && results.length === 0 ? <p>{locale === "en" ? "No matching articles." : "未找到相关文章。"}</p> : null}
              {!searching && results.map((result) => <button key={result.id} type="button" onClick={() => openResult(result.slug)}><strong>{result.title}</strong>{result.excerpt ? <span>{result.excerpt}</span> : null}</button>)}
              {!query.trim() ? <p>{locale === "en" ? "Enter a keyword to search published articles." : "输入关键词搜索已发布文章。"}</p> : null}
            </div>
          </form>
        </div>
      ) : null}
    </header>
  );
}
