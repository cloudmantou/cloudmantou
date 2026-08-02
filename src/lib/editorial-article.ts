export type EditorialHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

function decodeHeadingEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (match, decimal, hex, name) => {
    const codePoint = decimal ? Number(decimal) : hex ? Number.parseInt(hex, 16) : null;
    if (codePoint !== null && Number.isSafeInteger(codePoint)) {
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    return named[String(name).toLowerCase()] ?? match;
  });
}

function stripInlineMarkdown(value: string): string {
  const stripped = value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  return decodeHeadingEntities(stripped);
}

export function slugifyArticleHeading(value: string): string {
  const normalized = stripInlineMarkdown(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "section";
}

export function createHeadingId(
  text: string,
  occurrence: Map<string, number>
): string {
  const base = slugifyArticleHeading(text);
  const next = (occurrence.get(base) ?? 0) + 1;
  occurrence.set(base, next);
  return next === 1 ? base : `${base}-${next}`;
}

export function extractArticleHeadings(content: string | null): EditorialHeading[] {
  if (!content) return [];
  const occurrence = new Map<string, number>();
  const headings: EditorialHeading[] = [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  let previousLine = "";

  const appendHeading = (rawText: string, level: 2 | 3) => {
    const text = stripInlineMarkdown(rawText);
    if (!text) return;
    headings.push({ id: createHeadingId(text, occurrence), text, level });
  };

  for (const line of content.split(/\r?\n/)) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (!fence) {
        fence = { marker, length: fenceMatch[1].length };
      } else if (fence.marker === marker && fenceMatch[1].length >= fence.length) {
        fence = null;
      }
      previousLine = "";
      continue;
    }
    if (fence) continue;

    if (/^\s{0,3}-{3,}\s*$/.test(line) && previousLine.trim()) {
      appendHeading(previousLine, 2);
      previousLine = "";
      continue;
    }

    const match = /^\s{0,3}(#{2,3})(?:[\t ]+|$)(.*?)(?:[\t ]+#+[\t ]*)?$/.exec(line);
    if (match) {
      appendHeading(match[2], match[1].length as 2 | 3);
      previousLine = "";
      continue;
    }
    previousLine = line.trim() ? line : "";
  }
  return headings;
}

export type AdjacentArticle = {
  slug: string;
  title: string;
};

export type EditorialTaxonomyItem = {
  slug: string;
  name: string;
  count?: number;
};

const CATEGORY_EN: Record<string, string> = {
  engineering: "Engineering",
  frontend: "Frontend",
  backend: "Backend",
  devops: "DevOps",
  "product-notes": "Product practice",
};

const TAG_EN: Record<string, string> = {
  ios: "iOS",
  "independent-development": "Independent development",
  "indie-development": "Independent development",
  "product-practice": "Product practice",
  cloudmantou: "CloudMantou",
  deployment: "Deployment",
  nextjs: "Next.js",
};

export const ENGLISH_EDITORIAL_TAGS: ReadonlyArray<EditorialTaxonomyItem> = [
  { slug: "ios", name: "iOS", count: 1 },
  { slug: "indie-development", name: "Independent development", count: 1 },
  { slug: "product-practice", name: "Product practice", count: 1 },
];

export function localizeEditorialTaxonomy(
  type: "category" | "tag",
  item: EditorialTaxonomyItem,
  locale: "zh" | "en"
): EditorialTaxonomyItem {
  if (locale === "zh") return item;
  const localized = (type === "category" ? CATEGORY_EN : TAG_EN)[item.slug];
  return localized ? { ...item, name: localized } : item;
}
