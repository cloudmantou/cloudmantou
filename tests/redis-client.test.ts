import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisHarness = vi.hoisted(() => {
  const instances: Array<{
    status: string;
    handlers: Record<string, (error: Error) => void>;
    on: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
  }> = [];

  return { instances };
});

vi.mock("ioredis", () => ({
  default: class RedisMock {
    status = "wait";
    handlers: Record<string, (error: Error) => void> = {};
    connect = vi.fn(async () => {
      this.status = "ready";
    });
    ping = vi.fn(async () => "PONG");
    on = vi.fn((event: string, handler: (error: Error) => void) => {
      this.handlers[event] = handler;
      return this;
    });

    constructor() {
      redisHarness.instances.push(this);
    }
  },
}));

describe("Redis client recovery", () => {
  beforeEach(() => {
    redisHarness.instances.length = 0;
    vi.resetModules();
    vi.stubEnv("REDIS_URL", "redis://example.test:6379");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not permanently disable Redis after a transient error event", async () => {
    const { getRedisClient } = await import("@/lib/redis");
    const first = getRedisClient();
    const instance = redisHarness.instances[0];

    instance?.handlers.error?.(new Error("temporary outage"));
    const recovered = getRedisClient();

    expect(first).not.toBeNull();
    expect(recovered).toBe(first);
  });

  it("replaces a client that has been permanently closed", async () => {
    const { getRedisClient } = await import("@/lib/redis");
    const first = getRedisClient();
    if (redisHarness.instances[0]) redisHarness.instances[0].status = "end";

    const recovered = getRedisClient();

    expect(recovered).not.toBe(first);
    expect(redisHarness.instances).toHaveLength(2);
  });

  it("lets ioredis finish an in-progress reconnect without calling connect twice", async () => {
    const { getRedisClient, redisPing } = await import("@/lib/redis");
    getRedisClient();
    const instance = redisHarness.instances[0];
    if (instance) instance.status = "reconnecting";

    await expect(redisPing()).resolves.toBe(true);
    expect(instance?.connect).not.toHaveBeenCalled();
    expect(instance?.ping).toHaveBeenCalledTimes(1);
  });
});
