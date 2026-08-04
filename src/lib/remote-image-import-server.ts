import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { isAllowedImageBuffer } from "@/lib/image-magic";
import { UPLOAD_MAX_INPUT_BYTES } from "@/lib/upload-config";

export type RemoteImageImportErrorCode =
  | "INVALID_URL"
  | "FORBIDDEN_ADDRESS"
  | "TOO_MANY_REDIRECTS"
  | "FETCH_TIMEOUT"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_IMAGE"
  | "FETCH_FAILED";

export class RemoteImageImportError extends Error {
  constructor(
    public readonly code: RemoteImageImportErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RemoteImageImportError";
  }
}

export type RemoteImageTransportInit = {
  redirect: "manual";
  pinnedAddress: ResolvedAddress;
  timeoutMs: number;
  signal: AbortSignal;
};

export type RemoteImageTransport = (
  url: string,
  init: RemoteImageTransportInit
) => Promise<Response>;

type FetchRemoteImageOptions = {
  transport?: RemoteImageTransport;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  signal?: AbortSignal;
};

type ResolvedAddress = { address: string; family: 4 | 6 };

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;
const MAX_REMOTE_URL_LENGTH = 4_096;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::", 96],
  ["::1", 128],
  ["::ffff:0.0.0.0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

class TransportTimeoutError extends Error {}
class TransportAbortedError extends Error {}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4Addresses.check(address, "ipv4");
  if (family === 6) return !blockedIpv6Addresses.check(address, "ipv6");
  return false;
}

function parseRemoteImageUrl(rawUrl: string): URL {
  if (!rawUrl || rawUrl.length > MAX_REMOTE_URL_LENGTH) {
    throw new RemoteImageImportError("INVALID_URL", "图片地址无效");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RemoteImageImportError("INVALID_URL", "图片地址无效");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443")
  ) {
    throw new RemoteImageImportError("INVALID_URL", "仅支持标准 HTTPS 图片地址");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new RemoteImageImportError("FORBIDDEN_ADDRESS", "图片地址不可访问");
  }

  return parsed;
}

async function waitForDns<T>(
  request: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new RemoteImageImportError("FETCH_FAILED", "图片导入已取消");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  return Promise.race([
    request,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RemoteImageImportError("FETCH_TIMEOUT", "图片主机解析超时")),
        timeoutMs
      );
    }),
    new Promise<never>((_, reject) => {
      abort = () => reject(new RemoteImageImportError("FETCH_FAILED", "图片导入已取消"));
      signal?.addEventListener("abort", abort, { once: true });
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  });
}

async function resolvePublicAddress(
  url: URL,
  deadline: number,
  signal?: AbortSignal
): Promise<ResolvedAddress> {
  const hostname = normalizeHostname(url.hostname);
  if (signal?.aborted) {
    throw new RemoteImageImportError("FETCH_FAILED", "图片导入已取消");
  }
  if (Date.now() >= deadline) {
    throw new RemoteImageImportError("FETCH_TIMEOUT", "图片主机解析超时");
  }
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (!isPublicAddress(hostname)) {
      throw new RemoteImageImportError("FORBIDDEN_ADDRESS", "图片地址不可访问");
    }
    return { address: hostname, family: literalFamily as 4 | 6 };
  }

  let addresses: ResolvedAddress[];
  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new RemoteImageImportError("FETCH_TIMEOUT", "图片主机解析超时");
    }
    const resolved = await waitForDns(
      lookup(hostname, { all: true, verbatim: true }),
      remaining,
      signal
    );
    if (resolved.some((entry) => entry.family !== 4 && entry.family !== 6)) {
      throw new Error("unsupported address family");
    }
    addresses = resolved as ResolvedAddress[];
  } catch (error) {
    if (error instanceof RemoteImageImportError) throw error;
    throw new RemoteImageImportError("FETCH_FAILED", "图片主机解析失败");
  }

  if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new RemoteImageImportError("FORBIDDEN_ADDRESS", "图片地址不可访问");
  }
  return addresses[0];
}

function responseHeaders(rawHeaders: NodeJS.Dict<string | string[]>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

const pinnedHttpsTransport: RemoteImageTransport = (rawUrl, init) =>
  new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const hostname = normalizeHostname(url.hostname);
    const pinnedLookup = ((
      _requestedHost: string,
      options: unknown,
      callback: (...args: unknown[]) => void
    ) => {
      const wantsAll = typeof options === "object" && options !== null && "all" in options
        ? Boolean((options as { all?: boolean }).all)
        : false;
      if (wantsAll) {
        callback(null, [init.pinnedAddress]);
      } else {
        callback(null, init.pinnedAddress.address, init.pinnedAddress.family);
      }
    }) as LookupFunction;

    const request = httpsRequest(
      url,
      {
        method: "GET",
        agent: false,
        lookup: pinnedLookup,
        servername: isIP(hostname) ? undefined : hostname,
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8",
          "Accept-Encoding": "identity",
          "User-Agent": "CloudMantou-Image-Importer/1.0",
        },
      },
      (incoming) => {
        try {
          const status = incoming.statusCode || 502;
          const hasNoBody = status === 204 || status === 205 || status === 304;
          const body = hasNoBody
            ? null
            : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
          resolve(new Response(body, { status, headers: responseHeaders(incoming.headers) }));
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      }
    );

    const abortRequest = () => {
      request.destroy(new TransportTimeoutError("remote image request timed out"));
    };
    if (init.signal.aborted) abortRequest();
    else init.signal.addEventListener("abort", abortRequest, { once: true });
    request.once("close", () => init.signal.removeEventListener("abort", abortRequest));

    request.setTimeout(init.timeoutMs, () => {
      request.destroy(new TransportTimeoutError("remote image request timed out"));
    });
    request.once("error", reject);
    request.end();
  });

async function cancelResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The connection is already closed.
  }
}

async function waitForTransport(
  transport: RemoteImageTransport,
  url: string,
  init: Omit<RemoteImageTransportInit, "signal">,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) throw new TransportAbortedError("remote image request aborted");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  return Promise.race([
    transport(url, { ...init, signal: controller.signal }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => {
          controller.abort();
          reject(new TransportTimeoutError("remote image request timed out"));
        },
        timeoutMs
      );
    }),
    new Promise<never>((_, reject) => {
      abort = () => {
        controller.abort();
        reject(new TransportAbortedError("remote image request aborted"));
      };
      externalSignal?.addEventListener("abort", abort, { once: true });
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
    if (abort) externalSignal?.removeEventListener("abort", abort);
  });
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  deadline: number,
  signal?: AbortSignal
): Promise<Buffer> {
  if (signal?.aborted) {
    await cancelResponse(response);
    throw new RemoteImageImportError("FETCH_FAILED", "图片导入已取消");
  }
  if (!response.body) {
    throw new RemoteImageImportError("UNSUPPORTED_IMAGE", "图片响应为空");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new RemoteImageImportError("FETCH_FAILED", "图片导入已取消"));
    signal?.addEventListener("abort", abort, { once: true });
  });

  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new RemoteImageImportError("FETCH_TIMEOUT", "图片下载超时");
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const next = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new RemoteImageImportError("FETCH_TIMEOUT", "图片下载超时")),
            remaining
          );
        }),
        aborted,
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        throw new RemoteImageImportError("RESPONSE_TOO_LARGE", "远程图片超过大小限制");
      }
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export async function fetchRemoteImage(
  sourceUrl: string,
  options: FetchRemoteImageOptions = {}
): Promise<{ buffer: Buffer; finalUrl: string; contentType: string }> {
  const transport = options.transport || pinnedHttpsTransport;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes || UPLOAD_MAX_INPUT_BYTES;
  const deadline = Date.now() + timeoutMs;
  let current = parseRemoteImageUrl(sourceUrl);

  for (let redirectCount = 0; ; redirectCount += 1) {
    if (options.signal?.aborted) {
      throw new RemoteImageImportError("FETCH_FAILED", "图片导入已取消");
    }
    const pinnedAddress = await resolvePublicAddress(current, deadline, options.signal);
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new RemoteImageImportError("FETCH_TIMEOUT", "图片下载超时");
    }

    let response: Response;
    try {
      response = await waitForTransport(
        transport,
        current.toString(),
        {
          redirect: "manual",
          pinnedAddress,
          timeoutMs: remaining,
        },
        remaining,
        options.signal
      );
    } catch (error) {
      if (error instanceof TransportTimeoutError) {
        throw new RemoteImageImportError("FETCH_TIMEOUT", "图片下载超时");
      }
      if (error instanceof TransportAbortedError) {
        throw new RemoteImageImportError("FETCH_FAILED", "图片导入已取消");
      }
      throw new RemoteImageImportError("FETCH_FAILED", "图片下载失败");
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await cancelResponse(response);
      if (!location) {
        throw new RemoteImageImportError("FETCH_FAILED", "图片跳转地址无效");
      }
      if (redirectCount >= maxRedirects) {
        throw new RemoteImageImportError("TOO_MANY_REDIRECTS", "图片跳转次数过多");
      }
      current = parseRemoteImageUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      await cancelResponse(response);
      throw new RemoteImageImportError("FETCH_FAILED", "远程图片响应异常");
    }

    const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
    if (encoding && encoding !== "identity") {
      await cancelResponse(response);
      throw new RemoteImageImportError("UNSUPPORTED_IMAGE", "图片响应编码不受支持");
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (!contentType?.startsWith("image/") || contentType.includes("svg")) {
      await cancelResponse(response);
      throw new RemoteImageImportError("UNSUPPORTED_IMAGE", "远程内容不是受支持的图片");
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await cancelResponse(response);
      throw new RemoteImageImportError("RESPONSE_TOO_LARGE", "远程图片超过大小限制");
    }

    let buffer: Buffer;
    try {
      buffer = await readBodyWithLimit(response, maxBytes, deadline, options.signal);
    } catch (error) {
      if (error instanceof RemoteImageImportError) throw error;
      throw new RemoteImageImportError("FETCH_FAILED", "图片下载失败");
    }
    if (!isAllowedImageBuffer(buffer)) {
      throw new RemoteImageImportError("UNSUPPORTED_IMAGE", "远程内容不是受支持的图片");
    }

    return { buffer, finalUrl: current.toString(), contentType };
  }
}
