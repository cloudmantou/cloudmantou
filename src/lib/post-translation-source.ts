import { createHash } from "node:crypto";
import { fromMarkdown } from "mdast-util-from-markdown";

export type PostTranslationSource = {
  title: string;
  excerpt: string | null;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: unknown;
  socialTitle: string | null;
  socialDescription: string | null;
  status: string;
};

function normalizedKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))].sort();
}

export function computePostTranslationSourceHash(source: PostTranslationSource): string {
  const canonical = JSON.stringify({
    title: source.title,
    excerpt: source.excerpt,
    content: source.content,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    seoKeywords: normalizedKeywords(source.seoKeywords),
    socialTitle: source.socialTitle,
    socialDescription: source.socialDescription,
    status: source.status,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

type TranslationInvariantInput = {
  title: string;
  excerpt: string | null;
  content: string;
};

type MarkdownAstNode = {
  type: string;
  url?: string;
  identifier?: string;
  children?: MarkdownAstNode[];
};

function flattenMarkdownAst(node: MarkdownAstNode): MarkdownAstNode[] {
  return [
    node,
    ...(node.children || []).flatMap((child) => flattenMarkdownAst(child)),
  ];
}

function markdownDestinationTokens(text: string): string[] {
  const nodes = flattenMarkdownAst(fromMarkdown(text) as MarkdownAstNode);
  const definitions = new Map(
    nodes.flatMap((node) => (
      node.type === "definition" && node.identifier && node.url
        ? [[node.identifier, node.url] as const]
        : []
    )),
  );
  return nodes.flatMap((node) => {
    const directKind = node.type === "link"
      ? "link"
      : node.type === "image"
        ? "image"
        : null;
    if (directKind && node.url) {
      return [node.url, `${directKind}:${node.url}`];
    }
    const referenceKind = node.type === "linkReference"
      ? "link"
      : node.type === "imageReference"
        ? "image"
        : null;
    const destination = referenceKind && node.identifier
      ? definitions.get(node.identifier)
      : null;
    return destination ? [destination, `${referenceKind}:${destination}`] : [];
  });
}

function stripUnbalancedUrlPunctuation(value: string): string {
  let normalized = value.replace(/[`.,;:!?]+$/u, "");
  const pairs = [["(", ")"], ["[", "]"], ["{", "}"]] as const;
  for (const [opening, closing] of pairs) {
    const count = (text: string, character: string) => [...text].filter((item) => item === character).length;
    while (normalized.endsWith(closing) && count(normalized, closing) > count(normalized, opening)) {
      normalized = normalized.slice(0, -1);
    }
  }
  return normalized;
}

function protectedTranslationTokens(input: TranslationInvariantInput): string[] {
  const text = [input.title, input.excerpt || "", input.content].join("\n");
  const markdownTokens = markdownDestinationTokens(text);
  const bareDestinations = (text.match(/(?:https?:\/\/|mailto:)[^\s<>"']+/giu) || [])
    .map(stripUnbalancedUrlPunctuation);
  const codeTokens = [
    ...(text.match(/```[^\n]*\n[\s\S]*?```/gu) || []),
    ...(text.match(/`[^`\n]+`/gu) || []),
  ];
  const versionTokens = [
    ...(text.match(/\b(?:iOS|iPadOS|macOS|Windows)\s*\d+(?:\.\d+)*(?:\+)?(?=$|[^\w.]|[.](?=\s|$))/giu) || []),
    ...(text.match(/\b\d+\.\d+(?:\.\d+)*(?:\+)?(?=$|[^\w.]|[.](?=\s|$))/gu) || []),
  ];
  return [
    ...markdownTokens,
    ...bareDestinations,
    ...codeTokens,
    ...versionTokens,
  ];
}

function tokenCounts(tokens: string[]): Map<string, number> {
  return tokens.reduce((counts, token) => {
    const nextCounts = new Map(counts);
    nextCounts.set(token, (nextCounts.get(token) || 0) + 1);
    return nextCounts;
  }, new Map<string, number>());
}

function countDifferences(
  expected: Map<string, number>,
  actual: Map<string, number>,
): string[] {
  return [...expected.entries()].flatMap(([token, expectedCount]) => {
    const difference = expectedCount - (actual.get(token) || 0);
    return difference > 0 ? Array.from({ length: difference }, () => token) : [];
  });
}

export function validateTranslationPreservesSource(
  source: TranslationInvariantInput,
  translation: TranslationInvariantInput,
): { ok: boolean; missing: string[]; unexpected: string[] } {
  const sourceTokens = tokenCounts(protectedTranslationTokens(source));
  const translationTokens = tokenCounts(protectedTranslationTokens(translation));
  const missing = countDifferences(sourceTokens, translationTokens);
  const unexpected = countDifferences(translationTokens, sourceTokens);
  return {
    ok: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}
