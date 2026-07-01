"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="text-center max-w-md">
        <AlertTriangle
          size={48}
          className="mx-auto mb-4"
          style={{ color: "var(--rose)" }}
          aria-hidden="true"
        />
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif' }}
        >
          出了点问题
        </h1>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
        >
          页面遇到了意外错误，请尝试刷新。
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          重新加载
        </button>
      </div>
    </div>
  );
}
