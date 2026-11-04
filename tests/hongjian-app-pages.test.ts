import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HONGJIAN_APP, HONGJIAN_NAV, HONGJIAN_PAGES, getHongjianPage } from "@/config/hongjian-app";
import { isOfficialPublicPath } from "@/i18n/official";

const root = process.cwd();

function allText(key: keyof typeof HONGJIAN_PAGES): string {
  const page = getHongjianPage(key);
  return JSON.stringify(page);
}

describe("红笺墨语 App Store pages", () => {
  it("ships a route for every page under /apps/hongjian-moyu", () => {
    for (const key of HONGJIAN_NAV) {
      const page = getHongjianPage(key);
      expect(page.path.startsWith(HONGJIAN_APP.basePath)).toBe(true);
      const file = join(root, "src/app", page.path, "page.tsx");
      expect(existsSync(file), `missing ${file}`).toBe(true);
      expect(readFileSync(file, "utf8")).toContain(`page="${key}"`);
      expect(page.sections.length).toBeGreaterThan(1);
    }
  });

  it("stays outside the localized official routes so /en redirects never apply", () => {
    expect(isOfficialPublicPath(HONGJIAN_APP.basePath)).toBe(false);
  });

  it("never links to sideloading, IPA downloads or the card-key shop", () => {
    const shell = readFileSync(join(root, "src/components/hongjian/HongjianAppPage.tsx"), "utf8");
    for (const key of HONGJIAN_NAV) {
      const text = allText(key) + shell;
      for (const banned of ["IPA", "ipa", "/pricing", "/store", "/download", "卡密", "侧载", "签名"]) {
        expect(text, `${key} mentions ${banned}`).not.toContain(banned);
      }
    }
  });

  it("support page gives a contact email and feedback entry", () => {
    const text = allText("support");
    expect(text).toContain(HONGJIAN_APP.contactEmail);
    expect(text).toContain("意见反馈");
  });

  it("privacy policy discloses the official read-aloud provider and contact", () => {
    const text = allText("privacy");
    expect(text).toContain("小米 MiMo");
    expect(text).toContain(HONGJIAN_APP.contactEmail);
    expect(text).toContain(HONGJIAN_APP.bundleId);
  });

  it("terms defer to Apple's standard EULA", () => {
    expect(allText("terms")).toContain("Apple 标准许可协议");
  });
});
