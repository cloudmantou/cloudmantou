import { ImageProcessError, processUploadImage } from "@/lib/image-process-server";
import { saveUploadBufferDeduplicated } from "@/lib/local-storage";
import {
  fetchRemoteImage,
  RemoteImageImportError,
} from "@/lib/remote-image-import-server";
import type {
  RemoteImageFailureReason,
  RemoteImageImportItem,
  RemoteImageImportResult,
} from "@/lib/remote-image-types";
import type { UploadPurpose } from "@/lib/upload-config";
import { withRemoteImagePermit } from "@/lib/remote-image-concurrency";

const REMOTE_IMPORT_CONCURRENCY = 3;
const REMOTE_IMAGE_TOTAL_TIMEOUT_MS = 8_000;

function failureReason(error: unknown): RemoteImageFailureReason {
  if (error instanceof RemoteImageImportError) {
    if (error.code === "INVALID_URL" || error.code === "FORBIDDEN_ADDRESS") {
      return "UNSAFE_URL";
    }
    if (error.code === "RESPONSE_TOO_LARGE") return "TOO_LARGE";
    if (error.code === "UNSUPPORTED_IMAGE") return "INVALID_IMAGE";
    return "FETCH_FAILED";
  }
  if (error instanceof ImageProcessError) {
    return error.code === "INVALID_IMAGE" ? "INVALID_IMAGE" : "PROCESS_FAILED";
  }
  return "PROCESS_FAILED";
}

async function importOneRemoteImage(
  sourceUrl: string,
  purpose: UploadPurpose,
  options: { signal?: AbortSignal; timeoutMs: number }
): Promise<RemoteImageImportItem> {
  const deadline = Date.now() + options.timeoutMs;
  try {
    return await withRemoteImagePermit(async () => {
      const downloaded = await fetchRemoteImage(sourceUrl, {
        signal: options.signal,
        timeoutMs: Math.max(1, deadline - Date.now()),
      });
      const processed = await processUploadImage(downloaded.buffer, purpose);
      const saved = await saveUploadBufferDeduplicated(processed.buffer, "webp");

      return {
        sourceUrl,
        status: "imported" as const,
        url: saved.url,
        width: processed.width,
        height: processed.height,
        originalBytes: processed.originalBytes,
        compressedBytes: processed.compressedBytes,
        compressionRatio: processed.compressionRatio,
      };
    }, { deadline, signal: options.signal });
  } catch (error) {
    return { sourceUrl, status: "failed", reason: failureReason(error) };
  }
}

export async function importRemoteImages(
  sourceUrls: readonly string[],
  options: { purpose?: UploadPurpose; signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<RemoteImageImportResult> {
  const uniqueUrls = [...new Set(sourceUrls)];
  const purpose = options.purpose || "content";
  const timeoutMs = options.timeoutMs || REMOTE_IMAGE_TOTAL_TIMEOUT_MS;
  const items: RemoteImageImportItem[] = [];

  for (let offset = 0; offset < uniqueUrls.length; offset += REMOTE_IMPORT_CONCURRENCY) {
    const batch = uniqueUrls.slice(offset, offset + REMOTE_IMPORT_CONCURRENCY);
    items.push(
      ...(await Promise.all(
        batch.map((url) =>
          importOneRemoteImage(url, purpose, { signal: options.signal, timeoutMs })
        )
      ))
    );
  }

  const importedCount = items.filter((item) => item.status === "imported").length;
  return {
    items,
    importedCount,
    failedCount: items.length - importedCount,
  };
}
