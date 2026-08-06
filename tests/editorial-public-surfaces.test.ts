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
  it("uses the black-hole icon for browser metadata and public brand marks", () => {
    const editorialHeader = source("src/components/editorial/EditorialHeader.tsx");
    const editorialFooter = source("src/components/editorial/EditorialFooter.tsx");
    const officialNavbar = source("src/components/official/OfficialNavbar.tsx");
    const officialFooter = source("src/components/official/OfficialFooter.tsx");

    for (const component of [editorialHeader, editorialFooter, officialNavbar, officialFooter]) {
      expect(component).toContain("/brand/mantou-black-hole-icon.png");
    }
    for (const asset of [
      "public/brand/mantou-black-hole-icon.png",
      "src/app/icon.png",
      "src/app/apple-icon.png",
    ]) {
      expect(existsSync(join(root, asset)), `expected ${asset} to exist`).toBe(true);
    }
  });

  it("uses semantic article elements for archive and home cards", () => {
    const card = source("src/components/editorial/EditorialArticleCard.tsx");
    expect(card).toMatch(/<article className="editorial-article-item">/);
    expect(card).toMatch(/<Link[\s\S]*editorial-article/);
    expect(card).toMatch(/import Image from ["']next\/image["']/);
    expect(card).toMatch(/<Image[\s\S]*sizes=/);
    expect(card).not.toMatch(/backgroundImage:/);
  });

  it("keeps available covers visible on compact recent-article cards", () => {
    const card = source("src/components/editorial/EditorialArticleCard.tsx");
    const css = source("src/styles/editorial-blog.css");

    expect(card).toMatch(/const coverImage = safeCoverSource\(post\.coverImage\);/);
    expect(card).not.toMatch(/variant === ["']card["'] \? null : safeCoverSource/);
    expect(css).not.toMatch(
      /\.editorial-article-card \.editorial-article-media\s*\{[^}]*display:\s*none/,
    );
  });

  it("uses an explicit high-contrast foreground for inline and fenced code", () => {
    const globalCss = source("src/app/globals.css");
    const editorialCss = source("src/styles/editorial-blog.css");

    expect(globalCss).toMatch(/--article-code-text:\s*#[0-9a-f]{6}/i);
    expect(globalCss).toMatch(
      /\.article-prose code:not\(pre code\)\s*\{[^}]*color:\s*var\(--article-code-text\)/,
    );
    expect(globalCss).toMatch(
      /\.article-prose pre code\s*\{[^}]*color:\s*var\(--article-code-text\)/,
    );
    expect(editorialCss).toMatch(/--article-code-text:\s*#[0-9a-f]{6}/i);
  });

  it("renders the article hero cover as a prioritized image instead of a CSS background", () => {
    const chrome = source("src/components/editorial/EditorialArticleChrome.tsx");
    expect(chrome).toMatch(/import Image from ["']next\/image["']/);
    expect(chrome).toMatch(/<Image[\s\S]*fetchPriority="high"/);
    expect(chrome).not.toMatch(/backgroundImage:/);
  });

  it("sets immutable cache headers for content-addressed and UUID upload assets", () => {
    const nextConfig = source("next.config.mjs");
    expect(nextConfig).toMatch(/source:\s*["']\/uploads\/:path\*["']/);
    expect(nextConfig).toMatch(/public, max-age=2592000, immutable/);
    expect(nextConfig).toMatch(/qualities:\s*\[72,\s*75\]/);
    expect(nextConfig).toMatch(/minimumCacheTTL:\s*2592000/);
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
