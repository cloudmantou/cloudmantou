"use client";

import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { messages } = useOfficialI18n();
  return (
    <div className="auth-page">
      <HomeBackdrop />
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">🥟 {messages.site.name}</h1>
          <p className="auth-subtitle">{messages.site.description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
