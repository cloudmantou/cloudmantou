import Link from "next/link";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import { getEditorialBlogCopy } from "@/config/editorial-blog";

export function EditorialFooter({ locale }: { locale: OfficialLocale }) {
  const copy = getEditorialBlogCopy(locale);
  const policyLinks = locale === "en"
    ? [["About", "/about"], ["Privacy", "/privacy"], ["Disclaimer", "/disclaimer"], ["Contact", "/contact"]]
    : [["关于", "/about"], ["隐私说明", "/privacy"], ["使用声明", "/disclaimer"], ["联系与反馈", "/contact"]];

  return (
    <footer className="editorial-footer">
      <div className="editorial-container editorial-footer-inner">
        <div className="editorial-footer-brand">
          <span className="editorial-brand-mark" aria-hidden="true">馒</span>
          <span><strong>{copy.brand.name}</strong><small>{copy.brand.subtitle}</small></span>
        </div>
        <nav aria-label={locale === "en" ? "Editorial navigation" : "编辑站点导航"}>
          <Link href={localizeOfficialPath("/blog", locale)}>{copy.nav[1].label}</Link>
          <Link href={localizeOfficialPath("/pricing", locale)}>{copy.nav[3].label}</Link>
          {policyLinks.map(([label, path]) => <Link key={path} href={localizeOfficialPath(path, locale)}>{label}</Link>)}
        </nav>
        <p>© {new Date().getFullYear()} Mantou · cloudmantoua.top</p>
      </div>
    </footer>
  );
}
