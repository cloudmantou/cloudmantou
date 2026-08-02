import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { countArticleWords, estimateReadTime } from "@/components/blog/PostMeta";
import { ENGLISH_EDITORIAL_TAGS, extractArticleHeadings, localizeEditorialTaxonomy } from "@/lib/editorial-article";
import { localizeEditorialOrderTitle, localizeEditorialProduct } from "@/lib/editorial-commerce";
import type { Product } from "@/types";

const root = process.cwd();

function source(path: string) {
  const absolutePath = join(root, path);
  expect(existsSync(absolutePath), `expected ${path} to exist`).toBe(true);
  return readFileSync(absolutePath, "utf8");
}

describe("editorial phase two article-detail contract", () => {
  it("counts mixed-language prose and builds stable duplicate heading IDs", () => {
    const markdown = "## 开始 here\n正文 with words\n## 开始 here\n```md\n## ignored\n```";

    expect(countArticleWords(markdown)).toBeGreaterThanOrEqual(8);
    expect(estimateReadTime(markdown, "en")).toBe("1 min read");
    expect(extractArticleHeadings(markdown)).toEqual([
      { id: "开始-here", text: "开始 here", level: 2 },
      { id: "开始-here-2", text: "开始 here", level: 2 },
    ]);
  });

  it("keeps TOC extraction aligned for indented headings, tilde fences, and setext headings", () => {
    const markdown = "Title\n---\n   ## Indented heading\n~~~md\n## ignored\n~~~";

    expect(extractArticleHeadings(markdown)).toEqual([
      { id: "title", text: "Title", level: 2 },
      { id: "indented-heading", text: "Indented heading", level: 2 },
    ]);
  });

  it("adds visible word count and reading-time metadata from article content", () => {
    const postMeta = source("src/components/blog/PostMeta.tsx");
    const postContent = source("src/app/post/[slug]/PostContent.tsx");
    const articleChrome = source("src/components/editorial/EditorialArticleChrome.tsx");

    expect(postMeta).toMatch(/export function (countArticleWords|countWords)/);
    expect(postMeta).toMatch(/(字|words)/);
    expect(postContent).toMatch(/(countArticleWords|countWords)\(post\.content\)/);
    expect(articleChrome).toMatch(/article-word-count/);
    expect(postContent).toMatch(/estimateReadTime\(post\.content,\s*locale\)/);
  });

  it("renders a heading-derived TOC whose links point at stable article anchors", () => {
    const postContent = source("src/app/post/[slug]/PostContent.tsx");
    const articleChrome = source("src/components/editorial/EditorialArticleChrome.tsx");
    const markdown = source("src/components/blog/MarkdownRenderer.tsx");

    expect(postContent).toMatch(/(buildArticle(?:TableOfContents|Toc|Outline)|extractArticleHeadings)/);
    expect(articleChrome).toMatch(/article-toc/);
    expect(articleChrome).toMatch(/href=\{`#\$\{(?:item|heading)\.id\}`\}/);
    expect(markdown).toMatch(/id=\{(?:slugify|headingId|createHeadingId)/);
  });

  it("turns tags into tag-archive links and provides a copyable canonical permalink", () => {
    const postMeta = source("src/components/blog/PostMeta.tsx");
    const articleChrome = source("src/components/editorial/EditorialArticleChrome.tsx");

    expect(postMeta).toMatch(/localizeOfficialPath\(`\/tag\/\$\{tag\.slug\}`,\s*locale\)/);
    expect(articleChrome).toMatch(/article-permalink/);
    expect(articleChrome).toMatch(/navigator\.clipboard\.writeText\(canonicalUrl\)/);
  });

  it("includes author and license context, adjacent articles, and a smooth return-to-top control", () => {
    const articleChrome = source("src/components/editorial/EditorialArticleChrome.tsx");
    const postPage = source("src/app/post/[slug]/page.tsx");

    expect(articleChrome).toMatch(/article-author-license/);
    expect(articleChrome).toMatch(/CC BY-NC-SA 4\.0/);
    expect(articleChrome).toMatch(/article-back-to-top/);
    expect(articleChrome).toMatch(/window\.scrollTo\(\{\s*top:\s*0,\s*behavior:\s*["']smooth["']/);
    expect(articleChrome).toMatch(/article-adjacent-navigation/);
    expect(postPage).toMatch(/(previousPost|prevPost)/);
    expect(postPage).toMatch(/(nextPost|followingPost)/);
  });
});

describe("editorial category and tag archives", () => {
  it("localizes known taxonomy without mutating the source item", () => {
    const item = { slug: "product-notes", name: "产品实践", count: 3 };
    const localized = localizeEditorialTaxonomy("category", item, "en");

    expect(localized).toEqual({ ...item, name: "Product practice" });
    expect(item.name).toBe("产品实践");
    expect(ENGLISH_EDITORIAL_TAGS.map((tag) => tag.slug)).toContain("indie-development");
  });

  it("renders category archives inside EditorialShell with localized labels", () => {
    const categoryPage = source("src/app/category/[slug]/page.tsx");
    const archivePage = source("src/components/editorial/EditorialArchivePage.tsx");

    expect(categoryPage).toMatch(/getRequestLocale/);
    expect(categoryPage).toMatch(/<EditorialShell locale=\{locale\}>/);
    expect(archivePage).toMatch(/locale:\s*OfficialLocale/);
    expect(archivePage).toMatch(/locale\s*===\s*["']en["']/);
    expect(archivePage).toMatch(/(No articles|暂无文章)/);
  });

  it("ships a localized tag archive using the same editorial shell", () => {
    const tagPage = source("src/app/tag/[slug]/page.tsx");

    expect(tagPage).toMatch(/getRequestLocale/);
    expect(tagPage).toMatch(/<EditorialShell locale=\{locale\}>/);
    expect(tagPage).toMatch(/locale\s*===\s*["']en["']/);
    expect(tagPage).toMatch(/(Posts tagged|标签)/);
    expect(tagPage).toMatch(/prisma\.tag\.findUnique/);
  });
});

describe("editorial pricing and checkout hooks", () => {
  it("localizes product copy while preserving the original product and order identity", () => {
    const product: Product = {
      id: "month",
      category: "membership",
      name: "月度会员",
      description: "会员权益",
      price: "¥9.90",
      stock: 20,
      badge: "热门",
      accent: "blue",
      cover: "linear-gradient(#145ee8, #101820)",
      productType: "VIP_MONTH",
    };

    const localized = localizeEditorialProduct(product, "en");
    expect(localized).toMatchObject({ id: "month", productType: "VIP_MONTH", name: "Monthly membership" });
    expect(product.name).toBe("月度会员");
  });

  it("keeps distinct English identities for dynamic card packages and order results", () => {
    const card = (overrides: Partial<Product>): Product => ({
      id: "card-id",
      category: "card",
      name: "动态卡密",
      description: "动态说明",
      price: "¥25",
      stock: 20,
      badge: "HOT",
      accent: "gold",
      cover: "linear-gradient(#145ee8, #101820)",
      productType: "CARD_PACKAGE",
      productSlug: "vip-30",
      cardType: "VIP_DAYS",
      cardValue: 30,
      ...overrides,
    });

    const monthly = localizeEditorialProduct(card({}), "en");
    const quarterly = localizeEditorialProduct(
      card({ id: "card-90", productSlug: "vip-90", cardValue: 90 }),
      "en"
    );

    expect(monthly.name).toBe("30-day membership card");
    expect(quarterly.name).toBe("90-day membership card");
    expect(monthly.name).not.toBe(quarterly.name);
    expect(monthly.description).not.toMatch(/[\u3400-\u9fff]/u);
    expect(
      localizeEditorialOrderTitle(
        {
          title: "VIP 90 天卡密",
          productType: "CARD_PACKAGE",
          productId: "card-90",
          product: quarterly,
        },
        "en"
      )
    ).toBe("90-day membership card");
    expect(
      localizeEditorialOrderTitle(
        { title: "年度会员", productType: "VIP_YEAR", productId: null },
        "en"
      )
    ).toBe("Annual membership");
  });

  it("returns product identity from order APIs and avoids the dead English devops route", () => {
    const orderRoute = source("src/app/api/orders/route.ts");
    const statusRoute = source("src/app/api/payment/status/route.ts");
    const pricing = source("src/components/official/PricingPageClient.tsx");
    const paymentResult = source("src/app/payment/result/page.tsx");
    const blogConfig = source("src/config/editorial-blog.ts");

    expect(orderRoute).toMatch(/productType:\s*order\.productType/);
    expect(orderRoute).toMatch(/productId:\s*order\.productId/);
    expect(statusRoute).toMatch(/productType:\s*order\.productType/);
    expect(statusRoute).toMatch(/productId:\s*order\.productId/);
    expect(pricing).toMatch(/localizeEditorialOrderTitle/);
    expect(paymentResult).toMatch(/localizeEditorialOrderTitle/);
    expect(blogConfig).not.toMatch(/name:\s*"Deployment Lab"[\s\S]{0,180}href:\s*"\/category\/devops"/);
  });

  it("gives the pricing surface editorial visual hooks without removing product selection", () => {
    const pricing = source("src/components/official/PricingPageClient.tsx");

    expect(pricing).toMatch(/editorial-pricing-page/);
    expect(pricing).toMatch(/editorial-pricing-(?:intro|notice)/);
    expect(pricing).toMatch(/editorial-pricing-(?:products|grid)/);
    expect(pricing).toMatch(/<ProductCard/);
    expect(pricing).toMatch(/setCheckoutOpen\(true\)/);
  });

  it("gives checkout editorial visual hooks while preserving Alipay and WeChat launch paths", () => {
    const checkout = source("src/components/payment/PaymentCheckout.tsx");

    expect(checkout).toMatch(/editorial-checkout/);
    expect(checkout).toMatch(/editorial-checkout-(?:order|channels)/);
    expect(checkout).toMatch(/launchPay\(["']ALIPAY["']\)/);
    expect(checkout).toMatch(/launchPay\(["']WECHAT["']\)/);
    expect(checkout).toMatch(/fetch\(["']\/api\/payment\/create["']/);
    expect(checkout).toMatch(/channel,\s*scene/);
    expect(checkout).toMatch(/payload\.type === ["']qrcode["']/);
  });
});
