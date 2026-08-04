import { readApiEnvelope } from "@/lib/client-api-response";
import {
  extractRemoteImageUrls,
  replaceImportedImageUrls,
} from "@/lib/markdown-remote-images";
import type {
  RemoteImageImportItem,
  RemoteImageImportResult,
} from "@/lib/remote-image-types";

const REMOTE_IMAGE_BATCH_SIZE = 10;

function isRemoteImageImportItem(value: unknown): value is RemoteImageImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.sourceUrl !== "string") return false;
  if (item.status === "failed") return typeof item.reason === "string";
  return (
    item.status === "imported" &&
    typeof item.url === "string" &&
    item.url.startsWith("/uploads/") &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.originalBytes === "number" &&
    typeof item.compressedBytes === "number" &&
    typeof item.compressionRatio === "number"
  );
}

function readItems(data: unknown): RemoteImageImportItem[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("图片导入响应格式错误");
  }
  const items = (data as Record<string, unknown>).items;
  if (!Array.isArray(items) || !items.every(isRemoteImageImportItem)) {
    throw new Error("图片导入响应格式错误");
  }
  return items;
}

async function importBatch(
  urls: string[],
  purpose: "content" | "cover"
): Promise<RemoteImageImportItem[]> {
  const response = await fetch("/api/admin/images/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, purpose }),
  });
  const envelope = await readApiEnvelope(response, "远程图片导入失败");
  return readItems(envelope.data);
}

export async function importRemoteImagesInMarkdown(
  markdown: string,
  purpose: "content" | "cover" = "content"
): Promise<RemoteImageImportResult & { markdown: string }> {
  const urls = extractRemoteImageUrls(markdown);
  if (urls.length === 0) {
    return { markdown, items: [], importedCount: 0, failedCount: 0 };
  }

  const items: RemoteImageImportItem[] = [];
  for (let offset = 0; offset < urls.length; offset += REMOTE_IMAGE_BATCH_SIZE) {
    const batch = urls.slice(offset, offset + REMOTE_IMAGE_BATCH_SIZE);
    try {
      items.push(...(await importBatch(batch, purpose)));
    } catch {
      items.push(
        ...batch.map((sourceUrl) => ({
          sourceUrl,
          status: "failed" as const,
          reason: "FETCH_FAILED" as const,
        }))
      );
    }
  }

  const importedCount = items.filter((item) => item.status === "imported").length;
  return {
    markdown: replaceImportedImageUrls(markdown, items),
    items,
    importedCount,
    failedCount: items.length - importedCount,
  };
}
