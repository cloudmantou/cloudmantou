"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";
import { normalizeInternalReturnUrl } from "@/lib/return-url";

function LoginForm() {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.auth;
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = normalizeInternalReturnUrl(
    searchParams.get("callbackUrl"),
    localizeOfficialPath("/", locale)
  );
  const registerHref = `${localizeOfficialPath("/register", locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(result.error === "CredentialsSignin" ? copy.credentialsInvalid : copy.loginFailed);
        return;
      }
      if (!result?.ok) {
        setError(copy.loginFailed);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(locale === "zh" && message.includes("频繁") ? message : copy.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="login-title"
      style={{ border: "3px solid var(--ed-ink)", background: "var(--ed-paper-strong)", boxShadow: "9px 9px 0 var(--ed-blue)", padding: "clamp(22px, 5vw, 36px)" }}
    >
      <h2 id="login-title" style={{ margin: 0, color: "var(--ed-ink)", fontSize: "1.5rem", fontWeight: 950 }}>
        {copy.login}
      </h2>
      {error ? (
        <p role="alert" style={{ margin: "18px 0 0", borderLeft: "6px solid var(--ed-red)", background: "#fff0ed", color: "#8d2118", fontSize: 13, fontWeight: 750, padding: 12 }}>
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 17, marginTop: 24 }}>
        <label style={{ display: "grid", gap: 7, color: "var(--ed-ink)", fontSize: 13, fontWeight: 850 }}>
          {copy.usernameOrEmail}
          <input
            type="text"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            autoComplete="username"
            style={{ width: "100%", border: "2px solid var(--ed-ink)", borderRadius: 0, background: "#fffdf6", color: "var(--ed-ink)", padding: "12px 13px" }}
          />
        </label>
        <label style={{ display: "grid", gap: 7, color: "var(--ed-ink)", fontSize: 13, fontWeight: 850 }}>
          {copy.password}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={copy.passwordPlaceholder}
            required
            autoComplete="current-password"
            style={{ width: "100%", border: "2px solid var(--ed-ink)", borderRadius: 0, background: "#fffdf6", color: "var(--ed-ink)", padding: "12px 13px" }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ minHeight: 46, border: "2px solid var(--ed-ink)", borderRadius: 0, background: "var(--ed-blue)", boxShadow: "4px 4px 0 var(--ed-ink)", color: "#fff", cursor: loading ? "wait" : "pointer", fontWeight: 900, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? copy.loggingIn : copy.login}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", color: "var(--ed-muted)", fontSize: 13 }}>
        {copy.noAccount}{" "}
        <Link href={registerHref} style={{ color: "var(--ed-blue)", fontWeight: 900, textDecoration: "underline", textUnderlineOffset: 3 }}>
          {copy.registerNow}
        </Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
