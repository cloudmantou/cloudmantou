"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";
import { normalizeInternalReturnUrl } from "@/lib/return-url";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.auth;
  const [form, setForm] = useState({ email: "", username: "", password: "", confirmPassword: "", nickname: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = normalizeInternalReturnUrl(
    searchParams.get("callbackUrl"),
    localizeOfficialPath("/", locale)
  );
  const loginHref = `${localizeOfficialPath("/login", locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const update = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          nickname: form.nickname || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(locale === "en" ? copy.registerFailed : data.message || copy.registerFailed);
        return;
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error || !result?.ok) {
        router.push(loginHref);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(copy.registerFailed);
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{ name: keyof typeof form; label: string; placeholder: string; type?: string; autoComplete?: string; required?: boolean }> = [
    { name: "email", label: copy.email, placeholder: copy.emailPlaceholder, type: "email", autoComplete: "email", required: true },
    { name: "username", label: copy.username, placeholder: copy.usernamePlaceholder, autoComplete: "username", required: true },
    { name: "nickname", label: copy.nickname, placeholder: copy.nicknamePlaceholder, autoComplete: "nickname" },
    { name: "password", label: copy.password, placeholder: copy.newPasswordPlaceholder, type: "password", autoComplete: "new-password", required: true },
    { name: "confirmPassword", label: copy.confirmPassword, placeholder: copy.confirmPasswordPlaceholder, type: "password", autoComplete: "new-password", required: true },
  ];

  return (
    <section aria-labelledby="register-title" style={{ border: "3px solid var(--ed-ink)", background: "var(--ed-paper-strong)", boxShadow: "9px 9px 0 var(--ed-red)", padding: "clamp(22px, 5vw, 36px)" }}>
      <h2 id="register-title" style={{ margin: 0, color: "var(--ed-ink)", fontSize: "1.5rem", fontWeight: 950 }}>
        {copy.register}
      </h2>
      {error ? <p role="alert" style={{ margin: "18px 0 0", borderLeft: "6px solid var(--ed-red)", background: "#fff0ed", color: "#8d2118", fontSize: 13, fontWeight: 750, padding: 12 }}>{error}</p> : null}
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 15, marginTop: 24 }}>
        {fields.map((field) => (
          <label key={field.name} style={{ display: "grid", gap: 7, color: "var(--ed-ink)", fontSize: 13, fontWeight: 850 }}>
            {field.label}
            <input
              name={field.name}
              type={field.type || "text"}
              value={form[field.name]}
              onChange={update}
              placeholder={field.placeholder}
              required={field.required}
              autoComplete={field.autoComplete}
              style={{ width: "100%", border: "2px solid var(--ed-ink)", borderRadius: 0, background: "#fffdf6", color: "var(--ed-ink)", padding: "11px 13px" }}
            />
          </label>
        ))}
        <button type="submit" disabled={loading} style={{ minHeight: 46, border: "2px solid var(--ed-ink)", borderRadius: 0, background: "var(--ed-red)", boxShadow: "4px 4px 0 var(--ed-ink)", color: "#fff", cursor: loading ? "wait" : "pointer", fontWeight: 900, opacity: loading ? 0.7 : 1 }}>
          {loading ? copy.registering : copy.register}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", color: "var(--ed-muted)", fontSize: 13 }}>
        {copy.hasAccount}{" "}
        <Link href={loginHref} style={{ color: "var(--ed-blue)", fontWeight: 900, textDecoration: "underline", textUnderlineOffset: 3 }}>
          {copy.loginNow}
        </Link>
      </p>
    </section>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
