"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  OFFICIAL_LOCALE_COOKIE,
  getOfficialMessages,
  localizeOfficialPath,
  type OfficialLocale,
  type OfficialMessages,
} from "@/i18n/official";

type OfficialI18nContextValue = {
  locale: OfficialLocale;
  messages: OfficialMessages;
  switching: boolean;
  setLocale: (locale: OfficialLocale) => void;
};

const OfficialI18nContext = createContext<OfficialI18nContextValue | null>(null);

export function OfficialI18nProvider({ locale, children }: { locale: OfficialLocale; children: ReactNode }) {
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const messages = getOfficialMessages(locale);

  const setLocale = (nextLocale: OfficialLocale) => {
    if (nextLocale === locale) return;
    setSwitching(true);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${OFFICIAL_LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    const currentUrl = `${pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(localizeOfficialPath(currentUrl, nextLocale));
  };

  return (
    <OfficialI18nContext.Provider value={{ locale, messages, switching, setLocale }}>
      {children}
    </OfficialI18nContext.Provider>
  );
}

export function useOfficialI18n(): OfficialI18nContextValue {
  const value = useContext(OfficialI18nContext);
  if (!value) throw new Error("useOfficialI18n must be used within OfficialI18nProvider");
  return value;
}
