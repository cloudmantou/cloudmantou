"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";

function LoginForm() {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.auth;
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || localizeOfficialPath("/", locale);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(locale === "zh" && message.includes("频繁") ? message : copy.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">{copy.login}</h2>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">{copy.usernameOrEmail}</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin"
            required
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">{copy.password}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={copy.passwordPlaceholder}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? copy.loggingIn : copy.login}
        </button>
      </form>

      <p className="auth-footer">
        {copy.noAccount}
        <Link href={localizeOfficialPath("/register", locale)} className="auth-link">
          {copy.registerNow}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
