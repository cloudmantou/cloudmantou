import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OfficialLocale } from "@/i18n/official";
import { localizeOfficialPath } from "@/i18n/official";
import {
  MANTOU_ASSISTANT_ARTICLE,
  MANTOU_ASSISTANT_ARTICLE_EN,
} from "@/config/editorial-blog";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { JsonLd } from "@/components/seo/JsonLd";
import { EditorialShell } from "@/components/editorial/EditorialShell";
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
      <article className="editorial-post-page min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <div className="editorial-static-article-topbar">
            <Link href={localizeOfficialPath("/", locale)}>
              <ArrowLeft size={15} aria-hidden="true" />
              {locale === "en" ? "Back home" : "返回首页"}
            </Link>
          </div>
          <article className="editorial-static-article-content">
            <Image
              src={article.coverImage}
              alt={article.title}
              width={1024}
              height={1024}
              className="editorial-static-article-cover"
              priority
            />
            <span className="editorial-static-article-category">
              {locale === "en" ? "Product practice" : MANTOU_ASSISTANT_ARTICLE.category}
            </span>
            <h1>{article.title}</h1>
            <p className="editorial-static-article-excerpt">{article.excerpt}</p>
            <MarkdownRenderer content={article.content} />
          </article>
        </div>
      </article>
    </EditorialShell>
  );
}
