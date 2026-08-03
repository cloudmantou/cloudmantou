import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isOfficialPublicPath, localizeOfficialPath } from "@/i18n/official";
import { getEditorialBlogCopy, getEditorialPublicInfo } from "@/config/editorial-blog";
import { getEditorialProjects } from "@/config/editorial-blog";

const root = process.cwd();

function source(path: string): string {
  const absolute = join(root, path);
  expect(existsSync(absolute), `expected ${path} to exist`).toBe(true);
  return readFileSync(absolute, "utf8");
}

describe("editorial public-information routes", () => {
  it("provides complete Chinese and English copy for every public-information page", () => {
    for (const locale of ["zh", "en"] as const) {
      for (const key of ["about", "privacy", "disclaimer", "contact"] as const) {
        const page = getEditorialPublicInfo(locale, key);
        expect(page.title).not.toHaveLength(0);
        expect(page.description).not.toHaveLength(0);
        expect(page.sections.length).toBeGreaterThan(1);
      }
    }
  });

  it("treats policy routes as localized public routes", () => {
    for (const path of ["/about", "/privacy", "/disclaimer", "/contact"]) {
      expect(isOfficialPublicPath(path)).toBe(true);
      expect(localizeOfficialPath(path, "en")).toBe(`/en${path}`);
      expect(localizeOfficialPath(`/en${path}`, "zh")).toBe(path);
    }
  });

  it("ships policy pages in the editorial shell", () => {
    for (const page of ["about", "privacy", "disclaimer", "contact"]) {
      const route = source(`src/app/${page}/page.tsx`);
      expect(route).toContain("EditorialShell");
      expect(route).toContain("EditorialPublicInfoPage");
    }
  });
});

describe("editorial chrome", () => {
  it("offers search, locale, and account controls in the responsive header", () => {
    const header = source("src/components/editorial/EditorialHeader.tsx");
    expect(header).toContain("useSession");
    expect(header).toContain("setLocale");
    expect(header).toContain("editorial-search");
    expect(header).toContain("Escape");
    expect(header).toContain('event.key !== "Tab"');
    expect(header).toContain("buildEditorialArchiveHref");
    expect(header).toContain("focus");
  });

  it("puts the policy links in a dedicated footer component", () => {
    const shell = source("src/components/editorial/EditorialShell.tsx");
    const footer = source("src/components/editorial/EditorialFooter.tsx");
    expect(shell).toContain("EditorialFooter");
    for (const path of ["/about", "/privacy", "/disclaimer", "/contact"]) {
      expect(footer).toContain(path);
    }
  });

  it("exposes public pages to robots and static sitemap coverage", () => {
    const robots = source("src/app/robots.ts");
    const sitemap = source("src/app/sitemap.ts");
    expect(robots).toContain('"/tag/"');
    for (const path of ["/about", "/privacy", "/disclaimer", "/contact"]) {
      expect(sitemap).toContain(`path: "${path}"`);
    }
  });

  it("keeps the original primary navigation available", () => {
    expect(getEditorialBlogCopy("zh").nav.map((item) => item.href)).toContain("/pricing");
    expect(getEditorialBlogCopy("en").nav.map((item) => item.href)).toContain("/blog");
    expect(getEditorialProjects("zh").find((project) => project.name === "部署实验室")?.href).toBe("/blog#articles");
  });
});
