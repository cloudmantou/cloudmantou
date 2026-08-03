import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAdjacentPostWhere,
  EDITORIAL_ADJACENT_ORDER,
} from "@/lib/editorial-adjacent";

const root = process.cwd();

function source(path: string) {
  const absolutePath = join(root, path);
  expect(existsSync(absolutePath), `expected ${path} to exist`).toBe(true);
  return readFileSync(absolutePath, "utf8");
}

describe("editorial public-surface closure", () => {
  it("uses semantic article elements for archive and home cards", () => {
    const card = source("src/components/editorial/EditorialArticleCard.tsx");
    expect(card).toMatch(/<article className="editorial-article-item">/);
    expect(card).toMatch(/<Link[\s\S]*editorial-article/);
  });

  it("localizes heading-anchor labels in Chinese and English article bodies", () => {
    const markdown = source("src/components/blog/MarkdownRenderer.tsx");
    const dynamicArticle = source("src/app/post/[slug]/PostContent.tsx");
    const staticArticle = source("src/components/editorial/EditorialStaticArticle.tsx");
    expect(markdown).toMatch(/locale\?:\s*["']zh["']\s*\|\s*["']en["']/);
    expect(markdown).toMatch(/locale === ["']en["'] \? `Link to/);
    expect(dynamicArticle).toMatch(/<MarkdownRenderer content=\{post\.content\} locale=\{locale\}/);
    expect(staticArticle).toMatch(/<MarkdownRenderer content=\{article\.content\} locale=\{locale\}/);
  });

  it.each(["features", "download", "docs"])(
    "renders /%s inside the editorial shell instead of the legacy official shell",
    (route) => {
      const page = source(`src/app/${route}/page.tsx`);
      expect(page).toMatch(/<EditorialShell locale=\{locale\}>/);
      expect(page).not.toMatch(/<OfficialShell/);
      expect(page).toMatch(/editorial-public-/);
    }
  );

  it("keeps the removed store out of download calls-to-action and retires public store routes", () => {
    const download = source("src/app/download/page.tsx");
    const store = source("src/app/store/page.tsx");
    const storeDetail = source("src/app/store/[slug]/page.tsx");

    expect(download).not.toMatch(/localizeOfficialPath\(["']\/store/);
    expect(download).toMatch(/getSiteSettings\(\)[\s\S]*\.catch\(\(\) => getDesktopDownloadUrls\(\)\)/);
    expect(store).toMatch(/redirect\([\s\S]*\/blog/);
    expect(storeDetail).toMatch(/redirect\([\s\S]*\/blog/);
  });

  it("uses a locale-aware account destination after payment", () => {
    const result = source("src/app/payment/result/page.tsx");
    expect(result).not.toMatch(/const DASHBOARD_ORDERS_URL = ["']\/dashboard/);
    expect(result).toMatch(/localizeOfficialPath\(["']\/dashboard\?paid=1#orders["'],\s*locale\)/);
    expect(result).toMatch(/<EditorialShell locale=\{locale\}>/);
    expect(result).toMatch(/aria-live="polite"/);
  });
});

describe("stable adjacent article ordering", () => {
  const publishedAt = new Date("2026-08-03T12:00:00.000Z");

  it("includes same-timestamp posts without selecting the current post", () => {
    expect(buildAdjacentPostWhere("previous", { id: "post-b", publishedAt })).toEqual({
      status: { in: ["PUBLISHED", "PAID_ONLY"] },
      OR: [
        { publishedAt: { lt: publishedAt } },
        { publishedAt, id: { lt: "post-b" } },
      ],
    });
    expect(buildAdjacentPostWhere("next", { id: "post-b", publishedAt })).toEqual({
      status: { in: ["PUBLISHED", "PAID_ONLY"] },
      OR: [
        { publishedAt: { gt: publishedAt } },
        { publishedAt, id: { gt: "post-b" } },
      ],
    });
  });

  it("uses a deterministic publishedAt plus id order", () => {
    expect(EDITORIAL_ADJACENT_ORDER.previous).toEqual([
      { publishedAt: "desc" },
      { id: "desc" },
    ]);
    expect(EDITORIAL_ADJACENT_ORDER.next).toEqual([
      { publishedAt: "asc" },
      { id: "asc" },
    ]);
  });
});
