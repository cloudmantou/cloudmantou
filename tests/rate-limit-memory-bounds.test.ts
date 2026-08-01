import { describe, expect, it } from "vitest";
import { memoryRateLimit } from "@/lib/rate-limit-memory";

describe("memory rate-limit bounds", () => {
  it("evicts the oldest live bucket when the hard capacity is reached", () => {
    const prefix = `bounded-${Date.now()}`;

    for (let index = 0; index <= 10_000; index += 1) {
      memoryRateLimit(`${prefix}:${index}`, 2, 60_000);
    }

    const oldest = memoryRateLimit(`${prefix}:0`, 2, 60_000);
    const newest = memoryRateLimit(`${prefix}:10000`, 2, 60_000);

    expect(oldest.remaining).toBe(1);
    expect(newest.remaining).toBe(0);
  });
});
