import Link from "next/link";
import type { ReactNode } from "react";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const copy = locale === "en"
    ? {
        eyebrow: "MEMBER ACCESS",
        title: "Continue your reading.",
        description: "Sign in or create an account to keep memberships, purchases, and article access in one place.",
        home: "Back to articles",
      }
    : {
        eyebrow: "会员入口",
        title: "继续你的阅读。",
        description: "登录或创建账户，将会员、购买记录和文章权益集中在同一个地方。",
        home: "返回文章",
      };

  return (
    <EditorialShell locale={locale}>
      <main
        className="editorial-auth-page"
        style={{ minHeight: "calc(100vh - 236px)", padding: "clamp(48px, 8vw, 100px) 16px" }}
      >
        <div style={{ width: "min(100%, 560px)", margin: "0 auto" }}>
          <div style={{ marginBottom: 26 }}>
            <p style={{ margin: 0, color: "var(--ed-blue)", fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>
              {copy.eyebrow}
            </p>
            <h1 style={{ margin: "11px 0 0", color: "var(--ed-ink)", fontSize: "clamp(2.2rem, 6vw, 4.3rem)", fontWeight: 950, letterSpacing: "-.07em", lineHeight: ".96" }}>
              {copy.title}
            </h1>
            <p style={{ margin: "18px 0 0", color: "var(--ed-muted)", fontWeight: 650, lineHeight: 1.7 }}>
              {copy.description}
            </p>
          </div>
          {children}
          <Link
            href={localizeOfficialPath("/blog", locale)}
            style={{ display: "inline-flex", marginTop: 22, color: "var(--ed-ink)", fontSize: 13, fontWeight: 850, textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            ← {copy.home}
          </Link>
        </div>
      </main>
    </EditorialShell>
  );
}
