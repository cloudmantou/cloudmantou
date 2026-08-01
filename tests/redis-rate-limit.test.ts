import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = {
  status: "ready",
  connect: vi.fn(),
  eval: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => redisMock,
}));

describe("Redis-backed rate limiting", () => {
  beforeEach(() => {
    redisMock.status = "ready";
    redisMock.connect.mockReset();
    redisMock.eval.mockReset();
    delete process.env.RATE_LIMIT_REQUIRE_REDIS;
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("increments the counter and applies its expiry atomically", async () => {
    redisMock.eval.mockResolvedValue([1, 60_000]);
    const { rateLimitAsync } = await import("@/lib/rate-limit-server");

    const result = await rateLimitAsync("login:ip:203.0.113.4", 10, 60_000);

    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("PEXPIRE"),
      1,
      "rl:login:ip:203.0.113.4",
      "60000"
    );
    expect(result).toMatchObject({ success: true, limit: 10, remaining: 9 });
  });

  it("repairs a counter that has lost its expiry", async () => {
    redisMock.eval.mockResolvedValue([4, 60_000]);
    const { rateLimitAsync } = await import("@/lib/rate-limit-server");

    const result = await rateLimitAsync("comment:203.0.113.4", 10, 60_000);

    expect(redisMock.eval.mock.calls[0]?.[0]).toContain("ttl < 0");
    expect(result).toMatchObject({ success: true, remaining: 6 });
  });
});
