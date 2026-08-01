import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitAsyncMock = vi.fn();

vi.mock("@/lib/rate-limit-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit-server")>();
  return {
    ...actual,
    rateLimitAsync: rateLimitAsyncMock,
  };
});

describe("login rate limiting", () => {
  beforeEach(() => {
    rateLimitAsyncMock.mockReset();
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checks the bounded IP bucket before allocating an identifier bucket", async () => {
    const denied = {
      success: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    };
    rateLimitAsyncMock.mockResolvedValue(denied);
    const { checkLoginRateLimitServer } = await import("@/lib/login-rate-limit-server");
    const request = new Request("https://example.test/login", {
      headers: { "x-forwarded-for": "203.0.113.4" },
    });

    const result = await checkLoginRateLimitServer(request, "User@Example.com");

    expect(result).toBe(denied);
    expect(rateLimitAsyncMock).toHaveBeenCalledTimes(1);
    expect(rateLimitAsyncMock).toHaveBeenCalledWith(
      "login:ip:203.0.113.4",
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("normalizes and bounds the identifier stored in Redis", async () => {
    rateLimitAsyncMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    const { checkLoginRateLimitServer } = await import("@/lib/login-rate-limit-server");
    const request = new Request("https://example.test/login", {
      headers: { "x-forwarded-for": "203.0.113.4" },
    });

    await checkLoginRateLimitServer(request, `USER-${"x".repeat(500)}@example.com`);

    const identifierKey = rateLimitAsyncMock.mock.calls[1]?.[0] as string;
    expect(identifierKey).toMatch(/^login:id:[a-f0-9]{64}$/);
    expect(identifierKey).not.toContain("example.com");
  });
});
