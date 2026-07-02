import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-card">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">页面不存在</h1>
        <p className="notfound-desc">404 — 你访问的页面不存在或已被移除</p>
        <div className="notfound-actions">
          <Link href="/" className="primary">
            <Home size={14} aria-hidden="true" />
            返回首页
          </Link>
          <Link href="/dashboard" className="secondary">
            <ArrowLeft size={14} aria-hidden="true" />
            会员中心
          </Link>
        </div>
      </div>
    </div>
  );
}
