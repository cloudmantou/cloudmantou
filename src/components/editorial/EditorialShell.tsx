import Link from "next/link";
import type { ReactNode } from "react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import { getEditorialBlogCopy } from "@/config/editorial-blog";
import { EditorialHeader } from "@/components/editorial/EditorialHeader";

export function EditorialShell({ locale, children }: { locale: OfficialLocale; children: ReactNode }) {
  const copy = getEditorialBlogCopy(locale);
  return (
    <div className="editorial-blog-page">
      <EditorialHeader locale={locale} />
      <main>{children}</main>
      <footer className="editorial-footer">
        <div className="editorial-container editorial-footer-inner">
          <div className="editorial-footer-brand">
            <span className="editorial-brand-mark" aria-hidden="true">馒</span>
            <span><strong>{copy.brand.name}</strong><small>{copy.brand.subtitle}</small></span>
          </div>
          <nav aria-label={locale === "en" ? "Footer navigation" : "页脚导航"}>
            <Link href={localizeOfficialPath("/blog", locale)}>{copy.nav[1].label}</Link>
            <Link href={localizeOfficialPath("/pricing", locale)}>{copy.nav[3].label}</Link>
            <Link href={localizeOfficialPath("/#about", locale)}>{copy.nav[4].label}</Link>
          </nav>
          <p>© {new Date().getFullYear()} Mantou · cloudmantoua.top</p>
        </div>
      </footer>
    </div>
  );
}
