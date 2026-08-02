import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EDITORIAL_BLOG,
  MANTOU_ASSISTANT_ARTICLE,
  getEditorialBlogCopy,
  getEditorialProjects,
} from "@/config/editorial-blog";
import { buildRootMetadata, withEditorialSeoContext, type SeoContext } from "@/lib/seo";

describe("editorial blog homepage contract", () => {
  it("uses a blog-first navigation while keeping the payment entry", () => {
    expect(EDITORIAL_BLOG.nav).toEqual([
      { label: "首页", href: "/" },
      { label: "文章", href: "/blog" },
      { label: "项目", href: "/#projects" },
      { label: "支持", href: "/pricing" },
      { label: "关于", href: "/#about" },
    ]);
    expect(EDITORIAL_BLOG.support.primaryAction.href).toBe("/pricing");
    expect(EDITORIAL_BLOG.support.primaryAction.label).toBe("查看会员与卡密");
  });

  it("positions Mantou Assistant as one article instead of the site identity", () => {
    expect(EDITORIAL_BLOG.brand.name).toBe("馒头");
    expect(EDITORIAL_BLOG.brand.name).not.toContain("助手");
    expect(MANTOU_ASSISTANT_ARTICLE).toMatchObject({
      slug: "mantou-assistant",
      title: "馒头助手：一款免费的 iOS 设备工具",
      coverImage: "/brand/mantou-assistant-icon.png",
    });
  });

  it("preserves the approved editorial hero copy and generated asset", () => {
    expect(EDITORIAL_BLOG.hero.title).toBe("把开发、产品与独立实践，写成能复用的经验。");
    expect(EDITORIAL_BLOG.hero.primaryAction).toEqual({ label: "开始阅读", href: "/blog" });
    expect(EDITORIAL_BLOG.hero.asset).toBe("/editorial/editorial-workbook.webp");
  });

  it("uses the editorial identity for site metadata without changing the canonical host", () => {
    const baseContext: SeoContext = {
      name: "馒头助手",
      subtitle: "免费的 iOS 设备必备工具",
      description: "产品官网",
      url: "https://cloudmantoua.top",
      locale: "zh",
    };

    const editorialContext = withEditorialSeoContext(baseContext);
    const metadata = buildRootMetadata(editorialContext, {
      keywords: ["独立开发", "产品实践", "技术博客"],
    });

    expect(editorialContext).toEqual({
      ...baseContext,
      name: "馒头",
      subtitle: "技术与产品的独立笔记",
      description: EDITORIAL_BLOG.hero.description,
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: "馒头",
      url: "https://cloudmantoua.top",
    });
    expect(metadata.keywords).toEqual(["独立开发", "产品实践", "技术博客"]);
  });

  it("provides localized editorial navigation, project summaries, and featured article copy", () => {
    expect(getEditorialBlogCopy("en").nav.map((item) => item.label)).toEqual([
      "Home",
      "Articles",
      "Projects",
      "Support",
      "About",
    ]);
    expect(getEditorialProjects("en")[0]).toMatchObject({
      name: "Mantou Assistant",
      article: {
        slug: "mantou-assistant",
        title: "Mantou Assistant: a free toolkit for iOS devices",
      },
    });
  });

  it("ships a readable fallback article and converges database content on repeated deploys", () => {
    expect(MANTOU_ASSISTANT_ARTICLE.content).toContain("最低系统统一为 **iOS 15.0+**");
    expect(MANTOU_ASSISTANT_ARTICLE.content).toContain("严禁将其用于任何违法行为");

    const upsertSource = readFileSync(
      join(process.cwd(), "scripts/upsert-mantou-article.mjs"),
      "utf8"
    );
    expect(upsertSource).toMatch(/title:\s*article\.title/);
    expect(upsertSource).toMatch(/excerpt:\s*article\.excerpt/);
    expect(upsertSource).toMatch(/content:\s*article\.content/);
  });
});
