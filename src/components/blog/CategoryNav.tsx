"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder } from "lucide-react";
import clsx from "clsx";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
};

type CategoryNavProps = {
  currentSlug?: string;
  className?: string;
};

export function CategoryNav({ currentSlug, className }: CategoryNavProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null;

  return (
    <nav className={className} aria-label="文章分类">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const isActive = cat.slug === currentSlug;
          return (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all duration-200",
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              )}
              style={{
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontFamily: '"DM Mono", monospace',
              }}
            >
              <Folder size={12} aria-hidden="true" />
              {cat.name}
              <span
                className="text-[10px] opacity-60"
              >
                {cat.postCount}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
