import Link from "next/link";
import { HONGJIAN_APP, HONGJIAN_NAV, getHongjianPage, type HongjianPageKey } from "@/config/hongjian-app";

/** 红笺墨语独立页面外壳：只链接本 App 的四个页面，不带站点导航。 */
export function HongjianAppPage({ page }: { page: HongjianPageKey }) {
  const copy = getHongjianPage(page);

  return (
    <div className="hongjian-page">
      <header className="hongjian-header">
        <div className="hongjian-container hongjian-header-inner">
          <Link href={HONGJIAN_APP.basePath} className="hongjian-brand">
            <span className="hongjian-brand-mark" aria-hidden="true">笺</span>
            <span>{HONGJIAN_APP.name}</span>
          </Link>
          <nav aria-label={`${HONGJIAN_APP.name} 页面`} className="hongjian-nav">
            {HONGJIAN_NAV.map((key) => {
              const item = getHongjianPage(key);
              return (
                <Link key={key} href={item.path} aria-current={key === page ? "page" : undefined}>
                  {item.navLabel}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main>
        <section className="hongjian-hero">
          <div className="hongjian-container">
            <span className="hongjian-eyebrow">{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
            {copy.updated ? <p className="hongjian-updated">{copy.updated}</p> : null}
          </div>
        </section>

        <div className="hongjian-container hongjian-sections">
          {copy.sections.map((section) => (
            <section key={section.title} className="hongjian-section">
              <h2>{section.title}</h2>
              {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
              {section.items ? (
                <ul>
                  {section.items.map((text) => <li key={text}>{text}</li>)}
                </ul>
              ) : null}
            </section>
          ))}

          {page === "support" ? (
            <section className="hongjian-section hongjian-contact">
              <h2>立即联系</h2>
              <div className="hongjian-actions">
                <a href={`mailto:${HONGJIAN_APP.contactEmail}?subject=${encodeURIComponent("红笺墨语反馈")}`}>发送邮件</a>
                <a href={HONGJIAN_APP.qqGroupUrl} rel="noopener noreferrer" target="_blank">加入用户群</a>
              </div>
            </section>
          ) : null}

          {copy.englishSummary ? (
            <section className="hongjian-section" lang="en">
              <h2>{copy.englishSummary.title}</h2>
              {copy.englishSummary.paragraphs.map((text) => <p key={text}>{text}</p>)}
            </section>
          ) : null}
        </div>
      </main>

      <footer className="hongjian-footer">
        <div className="hongjian-container">
          <p>
            © 2026 {HONGJIAN_APP.operator} · {HONGJIAN_APP.name} · {HONGJIAN_APP.contactEmail}
          </p>
        </div>
      </footer>
    </div>
  );
}
