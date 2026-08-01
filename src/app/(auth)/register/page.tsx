"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";

export default function RegisterPage() {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.auth;
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    nickname: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          nickname: form.nickname || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(locale === "en" ? copy.registerFailed : data.message || copy.registerFailed);
        return;
      }

      // 注册成功，自动登录
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push(localizeOfficialPath("/login", locale));
      } else {
        router.push(localizeOfficialPath("/", locale));
        router.refresh();
      }
    } catch {
      setError(copy.registerFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">{copy.register}</h2>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">{copy.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder={copy.emailPlaceholder}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="username">{copy.username}</label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            placeholder={copy.usernamePlaceholder}
            required
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="nickname">{copy.nickname}</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={form.nickname}
            onChange={handleChange}
            placeholder={copy.nicknamePlaceholder}
            autoComplete="nickname"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">{copy.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder={copy.newPasswordPlaceholder}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">{copy.confirmPassword}</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder={copy.confirmPasswordPlaceholder}
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? copy.registering : copy.register}
        </button>
      </form>

      <p className="auth-footer">
        {copy.hasAccount}
        <Link href={localizeOfficialPath("/login", locale)} className="auth-link">
          {copy.loginNow}
        </Link>
      </p>
    </div>
  );
}
