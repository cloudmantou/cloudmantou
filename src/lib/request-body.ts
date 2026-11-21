// Payment.rawCallback is a MySQL TEXT column (65,535 bytes). Leave headroom
// for charset/driver boundaries while keeping legitimate provider payloads ample.
export const DEFAULT_CALLBACK_BODY_LIMIT_BYTES = 60 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

async function consumeBodyWithLimit(
  request: Pick<Request, "headers" | "body">,
  limitBytes: number,
  consume: (chunk: Uint8Array) => void,
): Promise<number> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
    throw new TypeError("limitBytes must be a positive safe integer");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes);
  }

  if (!request.body) return 0;

  const reader = request.body.getReader();
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > limitBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError(limitBytes);
      }
      consume(value);
    }
    return receivedBytes;
  } finally {
    reader.releaseLock();
  }
}

/** Read a request body without allowing an untrusted callback to grow memory unbounded. */
export async function readRequestBodyWithLimit(
  request: Pick<Request, "headers" | "body">,
  limitBytes = DEFAULT_CALLBACK_BODY_LIMIT_BYTES,
): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  await consumeBodyWithLimit(request, limitBytes, (chunk) => {
    chunks.push(decoder.decode(chunk, { stream: true }));
  });
  chunks.push(decoder.decode());
  return chunks.join("");
}

export async function readBodyBytesWithLimit(request: Pick<Request, "headers" | "body">, limitBytes: number) {
  const chunks: Uint8Array[] = [];
  const length = await consumeBodyWithLimit(request, limitBytes, (chunk) => { chunks.push(chunk); });
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
