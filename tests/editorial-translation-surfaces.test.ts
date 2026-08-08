import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  const absolutePath = join(root, path);
  expect(existsSync(absolutePath), `expected ${path} to exist`).toBe(true);
  return readFileSync(absolutePath, "utf8");
}

describe("AI-generated English editorial translations", () => {
  it("stores English copy as an independently reviewable translation", () => {
    const schema = source("prisma/schema.prisma");

    expect(schema).toMatch(/model PostTranslation\s*\{/);
    expect(schema).toMatch(/enum PostTranslationStatus\s*\{[\s\S]*DRAFT[\s\S]*PUBLISHED[\s\S]*STALE/);
    expect(schema).toMatch(/@@unique\(\[postId,\s*locale\]\)/);
    expect(schema).toMatch(/sourceUpdatedAt\s+DateTime/);
  });

  it("provides a saved-post translation panel with generate, review, and publish states", () => {
    const editor = source("src/components/admin/PostEditor.tsx");
    const panel = source("src/components/admin/PostTranslationPanel.tsx");

    expect(editor).toMatch(/mode === ["']edit["'][\s\S]*<PostTranslationPanel/);
    expect(panel).toMatch(/AI 生成英文草稿/);
    expect(panel).toMatch(/保存英文草稿/);
    expect(panel).toMatch(/发布英文版/);
    expect(panel).toMatch(/原文已更新|STALE/);
    expect(panel).toMatch(/\/api\/admin\/posts\/\$\{postId\}\/translations\/en/);
  });

  it("automatically generates and publishes English copy after publishing Chinese source copy", () => {
    const editor = source("src/components/admin/PostEditor.tsx");
    const updateRoute = source("src/app/api/admin/posts/[id]/route.ts");

    expect(editor).toMatch(/submission\.status === ["']PUBLISHED["'][\s\S]*translations\/en/);
    expect(editor).toMatch(/translations\/en[\s\S]*status:\s*["']PUBLISHED["']/);
    expect(editor).toMatch(/英文草稿/);
    expect(updateRoute).toMatch(/translationSourceChanged/);
    expect(updateRoute).toMatch(/return ok\(\{ id, translationSourceChanged \}\)/);
  });

  it("renders English article routes from published database translations without Chinese fallback", () => {
    const page = source("src/app/post/[slug]/page.tsx");

    expect(page).toMatch(/ENGLISH_POST_TRANSLATION_LOCALE/);
    expect(page).toMatch(/ENGLISH_POST_TRANSLATION_STATUS/);
    expect(page).not.toMatch(/locale === ["']en["'] && slug !== MANTOU_ASSISTANT_ARTICLE\.slug\)\s*(?:return\s+)?notFound/);
    expect(page).toMatch(/translation\.title/);
    expect(page).toMatch(/translation\.content/);
  });

  it("feeds English home and archive cards from published translations with a governed legacy fallback", () => {
    const home = source("src/app/page.tsx");
    const archive = source("src/app/blog/page.tsx");

    for (const page of [home, archive]) {
      expect(page).toMatch(/ENGLISH_POST_TRANSLATION_LOCALE/);
      expect(page).toMatch(/ENGLISH_POST_TRANSLATION_STATUS/);
      expect(page).toMatch(/mapEnglishTranslatedPost/);
    }
    expect(home).toMatch(/canUseStaticEnglishMantouFallback/);
    expect(archive).toMatch(/canUseStaticEnglishMantouFallback/);
    expect(archive).toMatch(/getEnglishEditorialArchive\(/);
  });

  it("publishes English sitemap URLs only for published translations", () => {
    const sitemap = source("src/app/sitemap.ts");

    expect(sitemap).toMatch(/ENGLISH_POST_TRANSLATION_LOCALE/);
    expect(sitemap).toMatch(/ENGLISH_POST_TRANSLATION_STATUS/);
    expect(sitemap).toMatch(/p\.translations\.length > 0/);
    expect(sitemap).toMatch(/canUseStaticEnglishMantouFallback/);
  });

  it("marks existing English versions stale when public source copy changes", () => {
    const updateRoute = source("src/app/api/admin/posts/[id]/route.ts");

    expect(updateRoute).toMatch(/translationSourceChanged/);
    expect(updateRoute).toMatch(/tx\.postTranslation\.updateMany\([\s\S]*status:\s*["']STALE["']/);
  });

  it("never exposes an old English full text after the source becomes paid-only", () => {
    const detail = source("src/app/post/[slug]/page.tsx");
    const home = source("src/app/page.tsx");
    const updateRoute = source("src/app/api/admin/posts/[id]/route.ts");

    expect(detail).toMatch(/locale === ["']en["'][\s\S]*post\.status !== ["']PUBLISHED["']/);
    expect(home).toMatch(/const englishWhere[\s\S]*status:\s*["']PUBLISHED["']/);
    expect(updateRoute).toMatch(/data\.status !== undefined && data\.status !== post\.status/);
  });
});
