import type { ReactNode } from "react";
import type { OfficialLocale } from "@/i18n/official";
import { EditorialHeader } from "@/components/editorial/EditorialHeader";
import { EditorialFooter } from "@/components/editorial/EditorialFooter";

export function EditorialShell({ locale, children }: { locale: OfficialLocale; children: ReactNode }) {
  return (
    <div className="editorial-blog-page">
      <EditorialHeader locale={locale} />
      <main>{children}</main>
      <EditorialFooter locale={locale} />
    </div>
  );
}
