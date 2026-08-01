import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALLBACK_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  readRequestBodyWithLimit,
} from "@/lib/request-body";

describe("readRequestBodyWithLimit", () => {
  it("keeps the default below the MySQL TEXT storage ceiling", () => {
    expect(DEFAULT_CALLBACK_BODY_LIMIT_BYTES).toBeLessThan(65_535);
  });

  it("reads a callback whose byte length is within the limit", async () => {
    const request = new Request("https://example.test/callback", {
      method: "POST",
      body: "支付成功",
    });

    await expect(readRequestBodyWithLimit(request, 32)).resolves.toBe("支付成功");
  });

  it("rejects an oversized declared content length before reading", async () => {
    const request = new Request("https://example.test/callback", {
      method: "POST",
      headers: { "content-length": "1024" },
      body: "small",
    });

    await expect(readRequestBodyWithLimit(request, 64)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("rejects a chunked body as soon as the cumulative byte limit is exceeded", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("a".repeat(40)));
        controller.enqueue(new TextEncoder().encode("b".repeat(40)));
        controller.close();
      },
    });
    const request = new Request("https://example.test/callback", {
      method: "POST",
      body: stream,
      // Node requires duplex for streaming request bodies.
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readRequestBodyWithLimit(request, 64)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });
});
