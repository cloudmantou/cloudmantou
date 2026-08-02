"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import { getEditorialBlogCopy } from "@/config/editorial-blog";

export function EditorialHeader({ locale }: { locale: OfficialLocale }) {
  const [open, setOpen] = useState(false);
  const copy = getEditorialBlogCopy(locale);

  return (
    <header className="editorial-header">
      <div className="editorial-container editorial-header-inner">
        <Link className="editorial-brand" href={localizeOfficialPath("/", locale)} onClick={() => setOpen(false)}>
          <span className="editorial-brand-mark" aria-hidden="true">馒</span>
          <span>
            <strong>{copy.brand.name}</strong>
            <small>/ {copy.brand.alternateName}</small>
          </span>
          <em>{copy.brand.subtitle}</em>
        </Link>

        <nav className="editorial-nav" aria-label={locale === "en" ? "Primary navigation" : "主导航"}>
          {copy.nav.map((item) => (
            <Link key={item.href} href={localizeOfficialPath(item.href, locale)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="editorial-menu-button"
          aria-label={open ? (locale === "en" ? "Close menu" : "关闭菜单") : (locale === "en" ? "Open menu" : "打开菜单")}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={24} /> : <Menu size={26} />}
        </button>
      </div>

      <nav className={`editorial-mobile-nav${open ? " is-open" : ""}`} aria-label={locale === "en" ? "Mobile navigation" : "移动导航"}>
        {copy.nav.map((item) => (
          <Link key={item.href} href={localizeOfficialPath(item.href, locale)} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
