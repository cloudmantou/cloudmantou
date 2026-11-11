import { describe, it, expect, vi } from "vitest";
import { readIPAToolStatus } from "../src/lib/assistant-services";

const data = (profile: string) => ({ profile, auth: { locked: false, failureCount: 0, password: "MUST_NOT_LEAK" }, artifacts: { count: 0, bytes: 0, maxBytes: 100, highWaterBytes: 80, lowWaterBytes: 50, evicted: 0 }, secret: "MUST_NOT_LEAK" });
describe("IPATool monitoring boundary", () => {
  it("only calls fixed loopback ports, strips unknown fields and isolates failures by region", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("18091")) throw new Error("private transport detail");
      return Response.json({ success: true, data: data("cn") });
    });
    const samples = await readIPAToolStatus(fetcher as typeof fetch);
    expect(samples[0].reachable).toBe(true); expect(samples[1].reachable).toBe(false);
    expect(JSON.stringify(samples)).not.toMatch(/MUST_NOT_LEAK|private transport/);
    expect(fetcher.mock.calls.map(c => c[0])).toEqual(["http://127.0.0.1:18092/api/status", "http://127.0.0.1:18091/api/status"]);
  });
  it("rejects region confusion, oversized responses and invalid status", async () => {
    const swapped = await readIPAToolStatus((async () => Response.json({ success: true, data: data("us") })) as typeof fetch);
    expect(swapped[0].reachable).toBe(false);
    const oversized = await readIPAToolStatus((async () => new Response("x".repeat(256 * 1024 + 1))) as typeof fetch);
    expect(oversized.every(s => !s.reachable)).toBe(true);
  });
});
