"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
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
      setError("两次密码输入不一致");
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
        setError(data.message || "注册失败");
        return;
      }

      // 注册成功，自动登录
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">注册</h2>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="请输入邮箱"
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            placeholder="2-20个字符"
            required
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="nickname">昵称（可选）</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={form.nickname}
            onChange={handleChange}
            placeholder="默认使用用户名"
            autoComplete="nickname"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="至少6个字符"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="再次输入密码"
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? "注册中..." : "注册"}
        </button>
      </form>

      <p className="auth-footer">
        已有账号？
        <Link href="/login" className="auth-link">
          立即登录
        </Link>
      </p>
    </div>
  );
}
