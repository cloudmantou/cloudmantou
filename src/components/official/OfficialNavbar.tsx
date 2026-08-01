"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { siteConfig } from "@/config/site";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath, stripOfficialLocalePrefix } from "@/i18n/official";
import { isAdminRole } from "@/lib/roles";

export function OfficialNavbar() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  const { locale, messages, switching, setLocale } = useOfficialI18n();
  const [open, setOpen] = useState(false);
  const isAdmin = isAdminRole(session?.user?.role);

  const accountHref = isAdmin ? "/admin" : session ? "/dashboard" : localizeOfficialPath("/login", locale);
  const normalizedPathname = stripOfficialLocalePrefix(pathname);
  const navLabels = messages.nav;

  return (
    <header className="official-nav">
      <div className="official-nav-inner">
        <Link href={localizeOfficialPath("/", locale)} className="official-brand" onClick={() => setOpen(false)}>
          <span className="official-brand-mark" aria-hidden="true">
            <Image src="/brand/mantou-assistant-icon.png" alt="" width={34} height={34} priority />
          </span>
          <span>
            <div>{messages.site.name}</div>
            <div className="official-brand-sub">{messages.site.alternateName}</div>
          </span>
        </Link>

        <nav className="official-nav-links" aria-label={navLabels.label}>
          {siteConfig.nav.map((item) => {
            const href = "href" in item ? item.href : "/";
            const labelKey = item.value as "features" | "store" | "download" | "docs";
            const localizedHref = localizeOfficialPath(href, locale);
            const active = normalizedPathname === href || (href !== "/" && normalizedPathname.startsWith(href));
            return (
              <Link
                key={item.value}
                href={localizedHref}
                className={clsx("official-nav-link", active && "is-active")}
              >
                {navLabels[labelKey]}
              </Link>
            );
          })}
        </nav>

        <div className="official-nav-actions">
          <Link href={accountHref} className="official-btn official-btn-ghost">
            {session ? (isAdmin ? navLabels.admin : navLabels.account) : navLabels.login}
          </Link>
          <button
            type="button"
            className="official-btn official-btn-ghost"
            aria-label={messages.language.switchLabel}
            disabled={switching}
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          >
            {messages.language.switchTo}
          </button>
          <Link href={localizeOfficialPath("/pricing", locale)} className="official-btn official-btn-primary">
            {navLabels.buyCard}
          </Link>
          <button
            type="button"
            className="official-menu-btn"
            aria-label={open ? navLabels.closeMenu : navLabels.openMenu}
            aria-expanded={open}
            aria-controls="official-mobile-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <div
        id="official-mobile-navigation"
        className={clsx("official-mobile-panel", open && "is-open")}
      >
        {siteConfig.nav.map((item) => {
          const href = "href" in item ? item.href : "/";
          const labelKey = item.value as "features" | "store" | "download" | "docs";
          return (
            <Link
              key={item.value}
              href={localizeOfficialPath(href, locale)}
              className="official-nav-link"
              onClick={() => setOpen(false)}
            >
              {navLabels[labelKey]}
            </Link>
          );
        })}
        <Link
          href={accountHref}
          className="official-nav-link"
          onClick={() => setOpen(false)}
        >
          {session ? (isAdmin ? navLabels.admin : navLabels.account) : navLabels.login}
        </Link>
        <button
          type="button"
          className="official-nav-link official-mobile-language"
          aria-label={messages.language.switchLabel}
          disabled={switching}
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        >
          {messages.language.switchTo}
        </button>
      </div>
    </header>
  );
}
