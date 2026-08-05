"use client";

import Image from "next/image";
import Link from "next/link";
import { DEFAULT_BLOG_SITE_URL } from "@/config/site";
import { ContactLinksRow } from "@/components/layout/ContactLinksRow";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";

export function OfficialFooter() {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.footer;
  const href = (path: string) => localizeOfficialPath(path, locale);

  return (
    <footer className="official-footer">
      <div className="official-container official-footer-grid">
        <div>
          <Link href={href("/")} className="official-brand" style={{ marginBottom: 12 }}>
            <span className="official-brand-mark" aria-hidden="true">
              <Image src="/brand/mantou-black-hole-icon.png" alt="" width={34} height={34} />
            </span>
            <span>
              <div>{messages.site.name}</div>
              <div className="official-brand-sub">{copy.alias}</div>
            </span>
          </Link>
          <p style={{ margin: "12px 0 0", color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.7 }}>
            {messages.site.description}
          </p>
          <div style={{ marginTop: 16 }}>
            <ContactLinksRow />
          </div>
        </div>

        <div>
          <h3>{copy.product}</h3>
          <Link href={href("/features")}>{copy.features}</Link>
          <Link href={href("/store")}>{copy.store}</Link>
          <Link href={href("/download")}>{copy.install}</Link>
          <Link href={href("/pricing")}>{copy.pricing}</Link>
        </div>

        <div>
          <h3>{copy.resources}</h3>
          <Link href={href("/docs")}>{copy.docs}</Link>
          <Link href={href("/blog")}>{copy.blog}</Link>
          <a href={DEFAULT_BLOG_SITE_URL} rel="noopener noreferrer">
            {copy.blogSite}
          </a>
          <Link href={href("/login")}>{copy.auth}</Link>
        </div>
      </div>

      <div className="official-container official-footer-copy">
        © {new Date().getFullYear()} {messages.site.name} · cloudmantoua.top
      </div>
    </footer>
  );
}
