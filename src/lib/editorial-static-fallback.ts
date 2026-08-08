import { MANTOU_ASSISTANT_ARTICLE } from "@/config/editorial-blog";

export type EnglishFallbackSourceState = {
  title: string;
  excerpt: string | null;
  content: string;
  status: string;
  translations: Array<{ status: string }>;
};

/**
 * Keep the bundled English Mantou article only as a migration bridge.
 * The fallback remains available while a draft is being prepared only when the
 * database source is byte-for-byte the bundled Chinese article. A reviewed
 * published translation always takes ownership of the slug.
 */
export function canUseStaticEnglishMantouFallback(
  source: EnglishFallbackSourceState | null,
): boolean {
  if (!source) return true;
  const matchesBundledSource = source.title === MANTOU_ASSISTANT_ARTICLE.title
    && source.excerpt === MANTOU_ASSISTANT_ARTICLE.excerpt
    && source.content === MANTOU_ASSISTANT_ARTICLE.content;
  const hasPublishedManagedTranslation = source.translations.some(
    (translation) => translation.status === "PUBLISHED",
  );
  return source.status === "PUBLISHED"
    && matchesBundledSource
    && !hasPublishedManagedTranslation;
}
