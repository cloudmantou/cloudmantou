import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function PostNotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--article-bg)" }}
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
          style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}
        >
          文章不存在
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
        >
          可能已被删除或链接有误
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回首页
        </Link>
      </div>
    </div>
  );
}
