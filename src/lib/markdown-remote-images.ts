export type ImportedRemoteImage = {
  sourceUrl: string;
  status: "imported";
  url: string;
};

export type FailedRemoteImage = {
  sourceUrl: string;
  status: "failed";
  reason: string;
};

export type RemoteImageReplacement = ImportedRemoteImage | FailedRemoteImage;

function remoteImagePattern(): RegExp {
  return /!\[[^\]\n]*\]\(\s*<?(https?:\/\/[^\s>)]+)>?(?:\s+["'][^"'\n]*["'])?\s*\)/gi;
}

/** 提取 Markdown 图片中的远程地址；不把普通链接、站内上传和 data URL 算作图片。 */
export function extractRemoteImageUrls(markdown: string): string[] {
  const unique = new Set<string>();
  for (const match of markdown.matchAll(remoteImagePattern())) {
    const sourceUrl = match[1];
    if (sourceUrl) unique.add(sourceUrl);
  }
  return [...unique];
}

/** 只替换导入成功的 Markdown 图片地址，失败项与普通链接保持原样。 */
export function replaceImportedImageUrls(
  markdown: string,
  items: readonly RemoteImageReplacement[]
): string {
  const imported = new Map(
    items
      .filter((item): item is ImportedRemoteImage => item.status === "imported")
      .map((item) => [item.sourceUrl, item.url] as const)
  );

  if (imported.size === 0) return markdown;

  return markdown.replace(remoteImagePattern(), (imageMarkdown, sourceUrl: string) => {
    const localUrl = imported.get(sourceUrl);
    return localUrl ? imageMarkdown.replace(sourceUrl, localUrl) : imageMarkdown;
  });
}
