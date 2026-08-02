import type { OfficialLocale } from "@/i18n/official";
import {
  MANTOU_ASSISTANT_ARTICLE,
  MANTOU_ASSISTANT_ARTICLE_EN,
} from "@/config/editorial-blog";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { countArticleWords, estimateReadTime } from "@/components/blog/PostMeta";
import { JsonLd } from "@/components/seo/JsonLd";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialArticleChrome } from "@/components/editorial/EditorialArticleChrome";
import { ENGLISH_EDITORIAL_TAGS, extractArticleHeadings } from "@/lib/editorial-article";
import { getCspNonce } from "@/lib/csp-nonce";
import {
  buildBlogPostingJsonLd,
  getSeoContext,
  withEditorialSeoContext,
} from "@/lib/seo";

export async function EditorialStaticMantouArticle({ locale }: { locale: OfficialLocale }) {
  const [baseCtx, nonce] = await Promise.all([getSeoContext(locale), getCspNonce()]);
  const ctx = withEditorialSeoContext(baseCtx);
  const article = locale === "en" ? MANTOU_ASSISTANT_ARTICLE_EN : MANTOU_ASSISTANT_ARTICLE;
  const publishedAt = new Date(article.publishedAt);
  const publishedAtIso = publishedAt.toISOString();
  const tags = locale === "en"
    ? ENGLISH_EDITORIAL_TAGS.map((tag) => ({ id: tag.slug, name: tag.name, slug: tag.slug }))
    : [
        { id: "ios", name: "iOS", slug: "ios" },
        { id: "indie-development", name: "独立开发", slug: "indie-development" },
        { id: "product-practice", name: "产品实践", slug: "product-practice" },
      ];

  return (
    <EditorialShell locale={locale}>
      <JsonLd
        ctx={ctx}
        nonce={nonce}
        variant="extra"
        extra={[
          buildBlogPostingJsonLd(ctx, {
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            coverImage: article.coverImage,
            publishedAt,
            updatedAt: publishedAt,
            authorName: locale === "en" ? "Mantou" : "馒头",
          }),
        ]}
      />
      <div className="editorial-post-page">
        <EditorialArticleChrome
          locale={locale}
          slug={article.slug}
          title={article.title}
          excerpt={article.excerpt}
          coverImage={article.coverImage}
          publishedAt={publishedAtIso}
          updatedAt={publishedAtIso}
          authorName={locale === "en" ? "Mantou" : "馒头"}
          category={{ name: locale === "en" ? "Product practice" : MANTOU_ASSISTANT_ARTICLE.category, slug: "product-notes" }}
          tags={tags}
          headings={extractArticleHeadings(article.content)}
          wordCount={countArticleWords(article.content)}
          readTime={estimateReadTime(article.content, locale)}
          recommendationHref="/download"
          recommendationLabel={locale === "en" ? "Get the tool" : "获取工具"}
        >
            <MarkdownRenderer content={article.content} />
        </EditorialArticleChrome>
      </div>
    </EditorialShell>
  );
}
