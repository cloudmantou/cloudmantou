import { beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_MAX_INPUT_BYTES } from "@/lib/upload-config";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: mocks.lookup,
  default: { lookup: mocks.lookup },
}));

import {
  fetchRemoteImage,
  RemoteImageImportError,
  type RemoteImageTransport,
} from "@/lib/remote-image-import-server";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function publicDnsAnswer(address = "93.184.216.34") {
  return [{ address, family: address.includes(":") ? 6 : 4 }];
}

function transportReturning(response: Response) {
  return vi.fn<RemoteImageTransport>().mockResolvedValue(response);
}

describe("remote image fetch security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockResolvedValue(publicDnsAnswer());
  });

  it.each([
    "http://images.example.test/photo.png",
    "ftp://images.example.test/photo.png",
    "https://user:password@images.example.test/photo.png",
    "https://images.example.test:8443/photo.png",
  ])("rejects non-HTTPS or credentialed/non-standard-port URL %s", async (url) => {
    const transport = vi.fn<RemoteImageTransport>();

    await expect(fetchRemoteImage(url, { transport })).rejects.toMatchObject({
      code: "INVALID_URL",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "https://127.0.0.1/image.png",
    "https://[::1]/image.png",
    "https://169.254.169.254/latest/meta-data",
    "https://[64:ff9b::7f00:1]/image.png",
    "https://[2002:7f00:1::]/image.png",
  ])("blocks literal loopback, private, link-local, and metadata targets %s", async (url) => {
    const transport = vi.fn<RemoteImageTransport>();

    await expect(fetchRemoteImage(url, { transport })).rejects.toMatchObject({
      code: "FORBIDDEN_ADDRESS",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(["10.0.0.8", "172.16.0.8", "192.168.1.8", "fe80::1", "fc00::1"])(
    "blocks hostnames resolving to a non-public address %s",
    async (address) => {
      mocks.lookup.mockResolvedValue(publicDnsAnswer(address));
      const transport = vi.fn<RemoteImageTransport>();

      await expect(
        fetchRemoteImage("https://images.example.test/photo.png", { transport }),
      ).rejects.toMatchObject({ code: "FORBIDDEN_ADDRESS" });
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("rejects mixed public/private DNS answers instead of selecting only the public one", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);
    const transport = vi.fn<RemoteImageTransport>();

    await expect(
      fetchRemoteImage("https://images.example.test/photo.png", { transport }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_ADDRESS" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("enforces a total request deadline", async () => {
    let signal: AbortSignal | undefined;
    const transport = vi.fn<RemoteImageTransport>((_url, init) => {
      signal = init.signal;
      return new Promise(() => undefined);
    });

    await expect(
      fetchRemoteImage("https://images.example.test/slow.png", {
        transport,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: "FETCH_TIMEOUT" });
    expect(signal?.aborted).toBe(true);
  });

  it("includes DNS lookup in the total deadline", async () => {
    mocks.lookup.mockImplementation(() => new Promise(() => undefined));
    const transport = vi.fn<RemoteImageTransport>();

    await expect(
      fetchRemoteImage("https://images.example.test/slow-dns.png", {
        transport,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: "FETCH_TIMEOUT" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("pins the verified DNS address into the actual transport", async () => {
    const transport = transportReturning(
      new Response(TINY_PNG, { status: 200, headers: { "content-type": "image/png" } }),
    );

    await fetchRemoteImage("https://images.example.test/photo.png", { transport });

    expect(transport).toHaveBeenCalledWith(
      "https://images.example.test/photo.png",
      expect.objectContaining({
        redirect: "manual",
        pinnedAddress: { address: "93.184.216.34", family: 4 },
      }),
    );
  });

  it("revalidates every redirect destination before requesting it", async () => {
    const transport = transportReturning(
      new Response(null, {
        status: 302,
        headers: { location: "https://127.0.0.1/private.png" },
      }),
    );

    await expect(
      fetchRemoteImage("https://images.example.test/photo.png", { transport }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_ADDRESS" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects redirect chains longer than three hops", async () => {
    const transport = vi
      .fn<RemoteImageTransport>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/two" } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/three" } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/four" } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/five" } }));

    await expect(
      fetchRemoteImage("https://images.example.test/one", { transport }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
    expect(transport).toHaveBeenCalledTimes(4);
    expect(mocks.lookup).toHaveBeenCalledTimes(4);
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    const transport = transportReturning(
      new Response(TINY_PNG, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(UPLOAD_MAX_INPUT_BYTES + 1),
        },
      }),
    );

    await expect(
      fetchRemoteImage("https://images.example.test/large.png", { transport }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("enforces the size limit while streaming when Content-Length is missing", async () => {
    const oversized = new Uint8Array(UPLOAD_MAX_INPUT_BYTES + 1);
    oversized.set(TINY_PNG);
    const transport = transportReturning(
      new Response(oversized, { status: 200, headers: { "content-type": "image/png" } }),
    );

    await expect(
      fetchRemoteImage("https://images.example.test/stream.png", { transport }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it.each([
    ["text/html", TINY_PNG],
    ["image/png", Buffer.from("not an image")],
  ])("requires both an image Content-Type and a supported magic header", async (contentType, body) => {
    const transport = transportReturning(
      new Response(body, { status: 200, headers: { "content-type": contentType } }),
    );

    await expect(
      fetchRemoteImage("https://images.example.test/not-valid.png", { transport }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE" });
  });

  it("returns a verified image buffer and final URL for a public HTTPS image", async () => {
    const transport = transportReturning(
      new Response(TINY_PNG, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const result = await fetchRemoteImage("https://images.example.test/photo.png", {
      transport,
    });

    expect(result.finalUrl).toBe("https://images.example.test/photo.png");
    expect(result.contentType).toBe("image/png");
    expect(result.buffer.equals(TINY_PNG)).toBe(true);
  });
});
