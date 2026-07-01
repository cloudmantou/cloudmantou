import Link from "next/link";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="text-center">
        <FileQuestion
          size={48}
          className="mx-auto mb-4"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        />
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif' }}
        >
          页面不存在
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
        >
          404 — 你访问的页面不存在或已被移除
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              fontFamily: '"DM Mono", monospace',
            }}
          >
            <Home size={14} aria-hidden="true" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
