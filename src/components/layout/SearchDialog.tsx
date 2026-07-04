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

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

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
        className="platform-search-trigger"
        aria-label="搜索文章"
      >
        <Search size={15} aria-hidden="true" />
        <span className="platform-search-trigger-text">搜索文章…</span>
        <kbd className="platform-search-kbd">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      <div className="platform-search-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="platform-search-modal" role="dialog" aria-modal="true" aria-label="搜索文章">
        <div className="platform-search-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索标题、摘要或正文…"
            className="platform-search-input"
          />
          <button type="button" onClick={() => setOpen(false)} className="platform-search-close" aria-label="关闭搜索">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="platform-search-results">
          {loading && <div className="platform-search-empty">搜索中…</div>}

          {!loading && query.trim() && results.length === 0 && (
            <div className="platform-search-empty">未找到相关文章</div>
          )}

          {!loading &&
            results.map((result, idx) => (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSelect(result.slug)}
                className={`platform-search-result${idx === selectedIdx ? " active" : ""}`}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <FileText size={16} className="platform-search-result-icon" aria-hidden="true" />
                <div className="platform-search-result-body">
                  <div className="platform-search-result-title">{result.title}</div>
                  <div className="platform-search-result-excerpt">
                    {result.matchedContent || result.excerpt || ""}
                  </div>
                  {result.category ? (
                    <span className="platform-search-result-tag">{result.category.name}</span>
                  ) : null}
                </div>
                <ArrowRight size={14} className="platform-search-result-arrow" aria-hidden="true" />
              </button>
            ))}

          {!loading && !query.trim() && (
            <div className="platform-search-empty">输入关键词开始搜索</div>
          )}
        </div>

        <div className="platform-search-footer">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>esc 关闭</span>
        </div>
      </div>
    </>
  );
}