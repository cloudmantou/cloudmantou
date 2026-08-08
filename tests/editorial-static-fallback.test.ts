import { describe, expect, it } from "vitest";
import { canUseStaticEnglishMantouFallback } from "@/lib/editorial-static-fallback";
import { MANTOU_ASSISTANT_ARTICLE } from "@/config/editorial-blog";

const bundledSource = {
  title: MANTOU_ASSISTANT_ARTICLE.title,
  excerpt: MANTOU_ASSISTANT_ARTICLE.excerpt,
  content: MANTOU_ASSISTANT_ARTICLE.content,
  status: "PUBLISHED",
  translations: [] as Array<{ status: string }>,
};

describe("static English Mantou article fallback", () => {
  it("is available when no database source exists", () => {
    expect(canUseStaticEnglishMantouFallback(null)).toBe(true);
  });

  it("is available only for a public source with no managed translation", () => {
    expect(canUseStaticEnglishMantouFallback(bundledSource)).toBe(true);
    expect(canUseStaticEnglishMantouFallback({ ...bundledSource, status: "DRAFT" })).toBe(false);
    expect(canUseStaticEnglishMantouFallback({ ...bundledSource, status: "PAID_ONLY" })).toBe(false);
    expect(canUseStaticEnglishMantouFallback({
      ...bundledSource,
      translations: [{ status: "DRAFT" }],
    })).toBe(true);
    expect(canUseStaticEnglishMantouFallback({
      ...bundledSource,
      translations: [{ status: "PUBLISHED" }],
    })).toBe(false);
    expect(canUseStaticEnglishMantouFallback({
      ...bundledSource,
      content: `${bundledSource.content}\n管理员修改`,
      translations: [{ status: "DRAFT" }],
    })).toBe(false);
  });
});
