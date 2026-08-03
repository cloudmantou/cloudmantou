import type { EditorialPublicInfoKey } from "@/config/editorial-blog";
import { getEditorialPublicInfo } from "@/config/editorial-blog";
import type { OfficialLocale } from "@/i18n/official";

export function EditorialPublicInfoPage({ locale, page }: { locale: OfficialLocale; page: EditorialPublicInfoKey }) {
  const copy = getEditorialPublicInfo(locale, page);

  return (
    <article className="editorial-public-info-page">
      <header className="editorial-public-info-hero">
        <div className="editorial-container">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>
      <section className="editorial-container editorial-public-info-sections" aria-label={copy.title}>
        {copy.sections.map((section, index) => (
          <section key={section.title} className="editorial-public-info-section">
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{section.title}</h2><p>{section.body}</p></div>
          </section>
        ))}
      </section>
    </article>
  );
}
