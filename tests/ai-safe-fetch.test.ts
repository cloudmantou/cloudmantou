import { describe, expect, it, vi } from "vitest";
import { createSafeAiFetch } from "@/lib/ai/safe-fetch-server";

describe("safe AI provider fetch", () => {
  it("pins a public provider request to the validated DNS address", async () => {
    const transport = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const secureFetch = createSafeAiFetch("https://provider.example/v1", 30_000, {
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await secureFetch("https://provider.example/v1/chat/completions", {
      method: "POST",
      body: "{}",
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect((transport.mock.calls[0][0] as Request).method).toBe("POST");
    expect(transport.mock.calls[0][1]).toEqual({ address: "93.184.216.34", family: 4 });
    expect(transport.mock.calls[0][2]).toBeLessThanOrEqual(30_000);
  });

  it("rejects private DNS results before starting the provider request", async () => {
    const transport = vi.fn();
    const secureFetch = createSafeAiFetch("https://provider.example/v1", 30_000, {
      resolveHost: async () => [{ address: "10.0.0.10", family: 4 }],
      transport,
    });

    await expect(secureFetch("https://provider.example/v1/chat/completions"))
      .rejects.toMatchObject({ code: "AI_INVALID_CONFIG" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("falls back to the next validated address after a network failure", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("IPv6 route unavailable"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const secureFetch = createSafeAiFetch("https://provider.example/v1", 30_000, {
      resolveHost: async () => [
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        { address: "93.184.216.34", family: 4 },
      ],
      transport,
    });

    await expect(secureFetch("https://provider.example/v1/chat/completions", {
      method: "POST",
      body: "{}",
    })).resolves.toMatchObject({ status: 200 });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.map((call) => call[1])).toEqual([
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ]);
  });

  it("rejects cross-origin redirects or endpoint substitutions", async () => {
    const transport = vi.fn();
    const secureFetch = createSafeAiFetch("https://provider.example/v1", 30_000, {
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(secureFetch("https://attacker.example/v1/chat/completions"))
      .rejects.toMatchObject({ code: "AI_INVALID_CONFIG" });
    expect(transport).not.toHaveBeenCalled();
  });
});
