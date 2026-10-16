import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSafeAiFetch } from "@/lib/ai/safe-fetch-server";

const loopback = async () => [{ address: "127.0.0.1", family: 4 as const }];

describe("safe AI fetch guards", () => {
  it("rejects credentials in the URL and empty DNS answers", async () => {
    const transport = vi.fn();
    const secureFetch = createSafeAiFetch("https://provider.example/v1", 30_000, { resolveHost: async () => [], transport });
    // WHATWG Request itself refuses URLs with embedded credentials.
    await expect(secureFetch("https://user:pass@provider.example/v1/chat")).rejects.toThrow(TypeError);
    await expect(secureFetch("https://provider.example/v1/chat")).rejects.toMatchObject({ code: "AI_INVALID_CONFIG" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("only permits loopback addresses for a loopback endpoint", async () => {
    const transport = vi.fn().mockResolvedValue(new Response("ok"));
    const publicDns = createSafeAiFetch("http://localhost:11434", 30_000, { resolveHost: async () => [{ address: "93.184.216.34", family: 4 }], transport });
    await expect(publicDns("http://localhost:11434/api")).rejects.toMatchObject({ code: "AI_INVALID_CONFIG" });
    const literal = createSafeAiFetch("http://127.0.0.1:11434", 30_000, { transport });
    await expect(literal("http://127.0.0.1:11434/api")).resolves.toBeInstanceOf(Response);
    expect(transport.mock.calls[0][1]).toEqual({ address: "127.0.0.1", family: 4 });
  });

  it("stops before dialing when aborted or out of time", async () => {
    const transport = vi.fn();
    const secureFetch = createSafeAiFetch("http://localhost:1", 30_000, { resolveHost: loopback, transport });
    const controller = new AbortController();
    controller.abort();
    await expect(secureFetch("http://localhost:1/x", { signal: controller.signal })).rejects.toThrow("AI request aborted");

    const expired = createSafeAiFetch("http://localhost:1", 0, { resolveHost: loopback, transport });
    await expect(expired("http://localhost:1/x")).rejects.toThrow("AI request timed out");
    expect(transport).not.toHaveBeenCalled();
  });

  it("wraps non-Error transport failures", async () => {
    const secureFetch = createSafeAiFetch("http://localhost:1", 30_000, { resolveHost: loopback, transport: vi.fn().mockRejectedValue("nope") });
    await expect(secureFetch("http://localhost:1/x")).rejects.toThrow("AI request timed out");
  });
});

describe("default pinned transport", () => {
  let server: Server;
  let base: string;
  const seen: { method?: string; body: string; headers: IncomingMessage["headers"] }[] = [];

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        seen.push({ method: req.method, body, headers: req.headers });
        if (req.url === "/empty") { res.writeHead(204); res.end(); return; }
        if (req.url === "/slow") return;
        res.writeHead(200, { "content-type": "application/json", "set-cookie": ["a=1", "b=2"] });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("sends the body through the pinned address and streams the response", async () => {
    const secureFetch = createSafeAiFetch(base, 5_000, { resolveHost: loopback });
    const response = await secureFetch(`${base}/chat`, { method: "POST", body: "{\"q\":1}", headers: { "content-type": "application/json" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain("a=1");
    const request = seen.at(-1)!;
    expect(request).toMatchObject({ method: "POST", body: "{\"q\":1}" });
    expect(request.headers["accept-encoding"]).toBe("identity");
    expect(request.headers.host).toBe(new URL(base).host);
  });

  it("returns bodiless responses for 204 and skips GET bodies", async () => {
    const secureFetch = createSafeAiFetch(base, 5_000, { resolveHost: loopback });
    const response = await secureFetch(`${base}/empty`);
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(seen.at(-1)).toMatchObject({ method: "GET", body: "" });
  });

  it("times out and aborts in-flight requests", async () => {
    const shortFetch = createSafeAiFetch(base, 50, { resolveHost: loopback });
    await expect(shortFetch(`${base}/slow`)).rejects.toThrow("AI request timed out");

    const controller = new AbortController();
    const secureFetch = createSafeAiFetch(base, 5_000, { resolveHost: loopback });
    const pending = secureFetch(`${base}/slow`, { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toThrow();
  });

  it("uses TLS with SNI for https endpoints", async () => {
    const httpsBase = base.replace("http:", "https:");
    const secureFetch = createSafeAiFetch(httpsBase, 2_000, { resolveHost: loopback });
    await expect(secureFetch(`${httpsBase}/chat`)).rejects.toThrow();
  });
});
