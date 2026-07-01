"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  matchedContent: string | null;
  category: { name: string; slug: string } | null;
  publishedAt: string | null;
};

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/posts?q=${encodeURIComponent(q.trim())}&pageSize=8`);
        const data = await res.json();
        setResults(data.data || []);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (slug: string) => {
    router.push(`/post/${slug}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx].slug);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
          fontFamily: '"DM Mono", monospace',
        }}
        aria-label="搜索文章"
      >
        <Search size={14} aria-hidden="true" />
        <span className="hidden sm:inline">搜索</span>
        <kbd
          className="hidden sm:inline text-[10px] px-1 py-0.5 rounded"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999]"
        style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className="fixed z-[1000] w-full max-w-xl rounded-xl overflow-hidden shadow-2xl"
        style={{
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="搜索文章"
      >
        {/* Input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Search size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索文章标题、摘要或内容..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)", fontFamily: '"Noto Serif SC", serif' }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded transition-colors hover:bg-[var(--card)]"
            aria-label="关闭搜索"
          >
            <X size={16} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div
              className="text-center py-8 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
            >
              搜索中...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div
              className="text-center py-8 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
            >
              未找到相关文章
            </div>
          )}

          {!loading && results.map((result, idx) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result.slug)}
              className="w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors"
              style={{
                background: idx === selectedIdx ? "var(--card-hover)" : "transparent",
              }}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <FileText
                size={16}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text)" }}
                >
                  {result.title}
                </div>
                <div
                  className="text-xs mt-0.5 line-clamp-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {result.matchedContent || result.excerpt || ""}
                </div>
                {result.category && (
                  <span
                    className="inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"DM Mono", monospace' }}
                  >
                    {result.category.name}
                  </span>
                )}
              </div>
              <ArrowRight
                size={14}
                className="mt-1 flex-shrink-0 opacity-0 transition-opacity"
                style={{
                  color: "var(--text-muted)",
                  opacity: idx === selectedIdx ? 0.6 : 0,
                }}
                aria-hidden="true"
              />
            </button>
          ))}

          {!loading && !query.trim() && (
            <div
              className="text-center py-8 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
            >
              输入关键词搜索文章
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-[10px]"
          style={{
            borderTop: "1px solid var(--border)",
            color: "var(--text-muted)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          <span>↑↓ 导航</span>
          <span>↵ 跳转</span>
          <span>esc 关闭</span>
        </div>
      </div>
    </>
  );
}
