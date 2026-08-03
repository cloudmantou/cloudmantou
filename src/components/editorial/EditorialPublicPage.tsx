import type { ReactNode } from "react";
import { EditorialOrbitArt } from "@/components/editorial/EditorialOrbitArt";

export function EditorialPublicHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="editorial-public-hero">
      <div className="editorial-container editorial-public-hero-grid">
        <div>
          <span className="editorial-public-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <EditorialOrbitArt label={title} />
      </div>
    </header>
  );
}

export function EditorialPublicSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="editorial-container editorial-public-section">
      <div className="editorial-section-heading editorial-public-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
