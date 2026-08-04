import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBlogPostingJsonLd,
  buildPageMetadata,
  type SeoContext,
} from "@/lib/seo";
import { postSeoFieldsSchema } from "@/lib/post-schema";
import { serializeJsonLd } from "@/lib/json-ld";

const context: SeoContext = {
  name: "馒头",
  subtitle: "技术与产品的独立笔记",
  description: "站点默认描述",
  url: "https://cloudmantoua.top",
  locale: "zh",
};

describe("article SEO and answer-engine discovery", () => {
  it("validates compact, deduplicated SEO and social metadata", () => {
    const parsed = postSeoFieldsSchema.parse({
      seoTitle: "iOS 应用降级方法",
      seoDescription: "说明 iOS 应用降级的条件、步骤与常见问题。",
      seoKeywords: ["iOS 应用降级", "iOS 应用降级", "App Store 旧版本"],
      socialTitle: "iOS 应用降级完整说明",
      socialDescription: "从适用条件到常见问题，完整说明 iOS 应用降级。",
    });

    expect(parsed.seoKeywords).toEqual(["iOS 应用降级", "App Store 旧版本"]);
    expect(() => postSeoFieldsSchema.parse({ seoKeywords: Array(13).fill("关键词") })).toThrow();
  });

  it("uses dedicated search metadata and distinct social copy", () => {
    const metadata = buildPageMetadata(context, {
      title: "页面标题",
      description: "搜索摘要",
      keywords: ["iOS 应用降级", "App Store 旧版本"],
      socialTitle: "社交分享标题",
      socialDescription: "社交分享摘要",
      path: "/post/ios-downgrade",
      type: "article",
    });

    expect(metadata).toMatchObject({
      title: "页面标题",
      description: "搜索摘要",
      keywords: ["iOS 应用降级", "App Store 旧版本"],
      openGraph: { title: "社交分享标题", description: "社交分享摘要" },
      twitter: { title: "社交分享标题", description: "社交分享摘要" },
    });
  });

  it("adds visible article taxonomy to BlogPosting structured data", () => {
    const jsonLd = buildBlogPostingJsonLd(context, {
      title: "iOS 应用降级方法",
      slug: "ios-downgrade",
      excerpt: "适用条件与步骤",
      seoDescription: "说明适用条件、步骤与限制。",
      seoKeywords: ["iOS 应用降级", "App Store 旧版本"],
      categoryName: "iOS 工具",
      coverImage: null,
      publishedAt: new Date("2026-08-04T00:00:00Z"),
      updatedAt: new Date("2026-08-04T00:00:00Z"),
      authorName: "Mantou",
    });

    expect(jsonLd).toMatchObject({
      description: "说明适用条件、步骤与限制。",
      keywords: ["iOS 应用降级", "App Store 旧版本"],
      articleSection: "iOS 工具",
    });
  });

  it("persists metadata through the schema, migration, editor and post APIs", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const createRoute = readFileSync("src/app/api/admin/posts/route.ts", "utf8");
    const updateRoute = readFileSync("src/app/api/admin/posts/[id]/route.ts", "utf8");
    const editor = readFileSync("src/components/admin/PostEditor.tsx", "utf8");

    for (const field of ["seoTitle", "seoDescription", "seoKeywords", "socialTitle", "socialDescription"]) {
      expect(schema).toContain(field);
      expect(createRoute).toContain(field);
      expect(updateRoute).toContain(field);
      expect(editor).toContain(field);
    }
  });

  it("publishes a public-only llms.txt article index", () => {
    const route = readFileSync("src/app/llms.txt/route.ts", "utf8");

    expect(route).toContain('status: "PUBLISHED"');
    expect(route).toContain("seoDescription");
    expect(route).not.toContain("paidContent");
  });

  it("serializes JSON-LD without allowing a script-closing sequence", () => {
    const malicious = "</script><script>alert(1)</script>";
    const serialized = serializeJsonLd({ description: malicious });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized)).toEqual({ description: malicious });
  });
});
