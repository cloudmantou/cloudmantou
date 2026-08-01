// Payment.rawCallback is a MySQL TEXT column (65,535 bytes). Leave headroom
// for charset/driver boundaries while keeping legitimate provider payloads ample.
export const DEFAULT_CALLBACK_BODY_LIMIT_BYTES = 60 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

/** Read a request body without allowing an untrusted callback to grow memory unbounded. */
export async function readRequestBodyWithLimit(
  request: Request,
  limitBytes = DEFAULT_CALLBACK_BODY_LIMIT_BYTES
): Promise<string> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
    throw new TypeError("limitBytes must be a positive safe integer");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes);
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
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
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}
