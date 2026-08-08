import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";
import { localizeEditorialTaxonomy } from "@/lib/editorial-article";

export const ENGLISH_POST_TRANSLATION_LOCALE = "en-US" as const;
export const ENGLISH_POST_TRANSLATION_STATUS = "PUBLISHED" as const;

export type EnglishTranslationCopy = {
  status?: string;
  title: string;
  excerpt: string | null;
  content?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: unknown;
  socialTitle?: string | null;
  socialDescription?: string | null;
  updatedAt?: Date;
};

export type EnglishTranslatedPostRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  status: "DRAFT" | "PUBLISHED" | "PAID_ONLY";
  isTop: boolean;
  category: { name: string; slug?: string } | null;
  author?: { username: string; nickname: string | null };
  translations: EnglishTranslationCopy[];
};

export function mapEnglishTranslatedPost(row: EnglishTranslatedPostRow): EditorialPostCardData {
  const translation = row.translations[0];
  if (!translation) {
    throw new Error(`Published English translation missing for ${row.slug}`);
  }

  return {
    slug: row.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    coverImage: row.coverImage,
    publishedAt: row.publishedAt,
    status: row.status,
    isTop: row.isTop,
    category: row.category
      ? localizeEditorialTaxonomy(
          "category",
          { slug: row.category.slug || "", name: row.category.name },
          "en",
        )
      : null,
    author: row.author,
  };
}

export function getPublishedEnglishTranslation<T extends EnglishTranslationCopy>(
  translations: T[],
): T | null {
  return translations.find((translation) => translation.status === ENGLISH_POST_TRANSLATION_STATUS)
    || null;
}
