"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

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
        setError(result.error === "CredentialsSignin" ? "用户名或密码错误" : "登录失败，请稍后重试");
        return;
      }

      if (!result?.ok) {
        setError("登录失败，请稍后重试");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("频繁") ? message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">登录</h2>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">用户名或邮箱</label>
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
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <p className="auth-footer">
        还没有账号？
        <Link href="/register" className="auth-link">
          立即注册
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