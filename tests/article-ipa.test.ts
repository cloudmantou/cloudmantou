import { describe, expect, it } from "vitest";
import { articleIpaInputSchema, parseIpaRange } from "@/lib/article-ipa";
import { isArticleDownloadHref, getArticleDownloadLink } from "@/lib/article-download";

describe("IPA download requests", () => {
  it("handles bounded, open-ended and suffix ranges", () => {
    expect(parseIpaRange("bytes=0-1023", 5000)).toEqual({ start: 0, end: 1023 });
    expect(parseIpaRange("bytes=4000-", 5000)).toEqual({ start: 4000, end: 4999 });
    expect(parseIpaRange("bytes=-10", 5000)).toEqual({ start: 4990, end: 4999 });
    expect(parseIpaRange("bytes=0-9000", 5000)).toEqual({ start: 0, end: 4999 });
    expect(parseIpaRange(null, 5000)).toBeNull();
  });
  it.each(["bytes=-0", "bytes=5000-", "bytes=5-2", "bytes=0-2,5-6", "bytes=1.5-2", "bytes=9007199254740992-", "bytes=-", "nonsense"])("rejects unsatisfiable or malformed range %s", header => {
    expect(parseIpaRange(header, 5000)).toBe(false);
  });
  it("permits only managed and legacy IPA URLs as prominent downloads", () => {
    expect(isArticleDownloadHref("/api/article-ipa/cmuz3vuw20001128guqczz86s/download")).toBe(true);
    expect(isArticleDownloadHref("/uploads/releases/app.ipa")).toBe(true);
    for (const url of ["javascript:alert(1)", "https://evil.test/app.ipa", "/uploads/releases/../../secret.ipa", "/api/article-ipa/../download"]) expect(isArticleDownloadHref(url)).toBe(false);
    expect(getArticleDownloadLink("```\n[example](/uploads/releases/a.ipa)\n```")).toBeNull();
  });
});
describe("article release editing", () => {
  const item = { id: "cmuz3vuw20001128guqczz86s", version: "1.0.5", notes: "修复问题" };
  it("rejects duplicate attachments and empty versions", () => {
    expect(articleIpaInputSchema.safeParse([item, item]).success).toBe(false);
    expect(articleIpaInputSchema.safeParse([{ ...item, version: " " }]).success).toBe(false);
    expect(articleIpaInputSchema.safeParse([{ ...item, notes: "x".repeat(5001) }]).success).toBe(false);
    expect(articleIpaInputSchema.parse([item])).toEqual([item]);
  });
});
