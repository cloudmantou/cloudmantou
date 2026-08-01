"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type StoreAppCategory, type StoreAppPublic } from "@/lib/store-apps";
import { PageHeader } from "@/components/official/sections";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";

const FILTER_IDS: Array<"all" | StoreAppCategory> = ["all", "READING", "TOOL", "ENTERTAINMENT", "OTHER"];

const GRADIENTS = [
  "linear-gradient(135deg, #e8637a, #bb6bff)",
  "linear-gradient(135deg, #4dd9b6, #6b9aff)",
  "linear-gradient(135deg, #f09848, #e8b964)",
];

export function StorePageClient({ apps }: { apps: StoreAppPublic[] }) {
  const { locale, messages } = useOfficialI18n();
  const copy = messages.pages.store;
  const categoryLabels = {
    READING: copy.filters.reading,
    TOOL: copy.filters.tool,
    ENTERTAINMENT: copy.filters.entertainment,
    OTHER: copy.filters.other,
  } as const;
  const [filter, setFilter] = useState<"all" | StoreAppCategory>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      const matchCategory = filter === "all" || app.category === filter;
      const matchQuery =
        !q ||
        app.name.toLowerCase().includes(q) ||
        (app.tagline || "").toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [apps, filter, query]);

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <div className="official-container">
        <div className="official-filter-bar">
          {FILTER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`official-filter-btn${filter === id ? " is-active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {id === "all" ? copy.filters.all : categoryLabels[id]}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
          }}
        />
        <div className="official-store-grid">
          {filtered.map((app, index) => (
            <Link
              key={app.id}
              href={localizeOfficialPath(`/store/${app.slug}`, locale)}
              className="official-app-card fade-up"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div
                className="official-app-icon"
                style={{ background: GRADIENTS[index % GRADIENTS.length] }}
              >
                {app.iconUrl ? (
                  <img
                    src={app.iconUrl}
                    alt=""
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  app.name.slice(0, 1)
                )}
              </div>
              <div className="official-detail-meta">
                {app.featured ? <span className="official-tag official-tag-featured">{copy.featured}</span> : null}
                <span className="official-tag">{categoryLabels[app.category]}</span>
              </div>
              <h3>{app.name}</h3>
              <p>{app.tagline || app.description.slice(0, 72)}</p>
            </Link>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p style={{ color: "var(--text-muted)", paddingBottom: 48 }}>{copy.empty}</p>
        ) : null}
      </div>
    </>
  );
}
