import { fromMarkdown } from "mdast-util-from-markdown";

type MarkdownNode = {
  type: string;
  url?: string;
  value?: string;
  children?: MarkdownNode[];
};

export type ArticleDownloadLink = { href: string; label: string };

export function isArticleDownloadHref(href: string | undefined): boolean {
  return !!href && (/^\/api\/article-ipa\/c[a-z0-9]+\/download$/.test(href) || /^\/uploads\/releases\/[A-Za-z0-9][A-Za-z0-9._-]*\.ipa$/i.test(href));
}

function nodeText(node: MarkdownNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join("");
}

export function getArticleDownloadLink(content: string | null): ArticleDownloadLink | null {
  if (!content) return null;
  const findLink = (node: MarkdownNode): ArticleDownloadLink | null => {
    if (node.type === "link" && node.url && isArticleDownloadHref(node.url)) {
      return { href: node.url, label: nodeText(node).trim() || "下载 IPA" };
    }
    for (const child of node.children ?? []) {
      const found = findLink(child);
      if (found) return found;
    }
    return null;
  };
  return findLink(fromMarkdown(content));
}
