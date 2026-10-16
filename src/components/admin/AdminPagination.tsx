"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageWindow } from "@/lib/admin-pagination";

type AdminPaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
};

export function AdminPagination({ page, totalPages, disabled, onChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;
  const items = buildPageWindow(page, totalPages);

  return (
    <nav className="pagination" aria-label="分页">
      <button
        type="button"
        className="pagination-item"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="上一页"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={`pagination-item${item === page ? " active" : ""}`}
            onClick={() => onChange(item)}
            disabled={disabled}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        className="pagination-item"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label="下一页"
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}
