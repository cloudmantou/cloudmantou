import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import {
  AiConfigurationError,
  isAiLoopbackHostname,
  isPublicAiAddress,
  normalizeAiHostname,
} from "@/lib/ai/config";

type ResolvedAddress = { address: string; family: 4 | 6 };
type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;
type AiTransport = (
  request: Request,
  address: ResolvedAddress,
  timeoutMs: number,
) => Promise<Response>;

type SafeAiFetchOptions = {
  resolveHost?: ResolveHost;
  transport?: AiTransport;
};

function invalidEndpoint(): never {
  throw new AiConfigurationError("AI_INVALID_CONFIG", "AI 服务地址不可访问");
}

function responseHeaders(rawHeaders: NodeJS.Dict<string | string[]>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

const defaultResolveHost: ResolveHost = async (hostname) => {
  const entries = await lookup(hostname, { all: true, verbatim: true });
  return entries.filter(
    (entry): entry is ResolvedAddress => entry.family === 4 || entry.family === 6,
  );
};

async function resolvePinnedAddresses(
  hostname: string,
  allowLoopback: boolean,
  resolveHost: ResolveHost,
): Promise<ResolvedAddress[]> {
  const normalized = normalizeAiHostname(hostname);
  const literalFamily = isIP(normalized);
  const addresses = literalFamily
    ? [{ address: normalized, family: literalFamily as 4 | 6 }]
    : await resolveHost(normalized);

  const addressIsAllowed = allowLoopback
    ? (address: ResolvedAddress) => isAiLoopbackHostname(address.address)
    : (address: ResolvedAddress) => isPublicAiAddress(address.address);
  if (addresses.length === 0 || addresses.some((address) => !addressIsAllowed(address))) {
    invalidEndpoint();
  }
  return addresses;
}

function pinnedLookup(address: ResolvedAddress): LookupFunction {
  return ((
    _hostname: string,
    options: unknown,
    callback: (...args: unknown[]) => void,
  ) => {
    const wantsAll = typeof options === "object"
      && options !== null
      && "all" in options
      && Boolean((options as { all?: boolean }).all);
    if (wantsAll) callback(null, [address]);
    else callback(null, address.address, address.family);
  }) as LookupFunction;
}

const defaultTransport: AiTransport = async (request, address, timeoutMs) => {
  const url = new URL(request.url);
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : Buffer.from(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers.entries());
  headers["accept-encoding"] = "identity";
  headers.host = url.host;

  return new Promise<Response>((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = transport(
      url,
      {
        method: request.method,
        headers,
        agent: false,
        lookup: pinnedLookup(address),
        ...(url.protocol === "https:" && !isIP(normalizeAiHostname(url.hostname))
          ? { servername: normalizeAiHostname(url.hostname) }
          : {}),
      },
      (incoming) => {
        try {
          const status = incoming.statusCode || 502;
          const hasNoBody = status === 204 || status === 205 || status === 304;
          const responseBody = hasNoBody
            ? null
            : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
          resolve(new Response(responseBody, {
            status,
            headers: responseHeaders(incoming.headers),
          }));
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      },
    );

    const abort = () => outgoing.destroy(new Error("AI request aborted"));
    if (request.signal.aborted) abort();
    else request.signal.addEventListener("abort", abort, { once: true });
    outgoing.once("close", () => request.signal.removeEventListener("abort", abort));
    outgoing.setTimeout(timeoutMs, () => outgoing.destroy(new Error("AI request timed out")));
    outgoing.once("error", reject);
    if (body?.length) outgoing.write(body);
    outgoing.end();
  });
};

export function createSafeAiFetch(
  baseURL: string,
  timeoutMs: number,
  options: SafeAiFetchOptions = {},
): typeof fetch {
  const expected = new URL(baseURL);
  const expectedHostname = normalizeAiHostname(expected.hostname);
  const allowLoopback = isAiLoopbackHostname(expectedHostname);
  const resolveHost = options.resolveHost || defaultResolveHost;
  const transport = options.transport || defaultTransport;

  return async (input, init) => {
    const request = new Request(input, { ...init, redirect: "manual" });
    const url = new URL(request.url);
    if (url.origin !== expected.origin || url.username || url.password) invalidEndpoint();

    const deadline = Date.now() + timeoutMs;
    const addresses = await resolvePinnedAddresses(url.hostname, allowLoopback, resolveHost);
    let lastError: unknown;
    for (const address of addresses) {
      if (request.signal.aborted) throw new Error("AI request aborted");
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      try {
        return await transport(request.clone(), address, remainingMs);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI request timed out");
  };
}
