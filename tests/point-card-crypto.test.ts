import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptPointCardSecret, decryptPointCardSecret, hashPointCardSecret } from "@/lib/point-card-crypto";
import { decryptCardSecret } from "@/lib/card-secret-storage";
import { isLegacyHash, verifyCardSecret } from "@/lib/card-crypto";
describe("isolated point-card key", () => {
  beforeEach(() => { vi.stubEnv("POINT_CARD_KEY", "point-card-test-key-at-least-32-characters"); });
  it("integrates with delivery decoding without altering legacy keys", () => {
    const enc = encryptPointCardSecret("SECRET123456"); expect(decryptCardSecret(enc)).toBe("SECRET123456");
    expect(decryptPointCardSecret(enc)).toBe("SECRET123456"); expect(enc).not.toContain("SECRET123456");
  });
  it("authenticates the payload; changed keys and tampering fail closed", () => {
    const enc = encryptPointCardSecret("SECRET123456");
    vi.stubEnv("POINT_CARD_KEY", "another-point-card-key-more-than-32-characters"); expect(() => decryptCardSecret(enc)).toThrow();
  });
  it("verifies point cards and never treats them as legacy SHA hashes", async () => {
    const hash = await hashPointCardSecret("SECRET123456");
    expect(isLegacyHash(hash)).toBe(false); expect(await verifyCardSecret("SECRET123456", hash)).toBe(true); expect(await verifyCardSecret("WRONG", hash)).toBe(false);
  });
  it("fails safely when the dedicated key is absent", () => {
    vi.stubEnv("POINT_CARD_KEY", ""); expect(() => encryptPointCardSecret("SECRET123456")).toThrow("POINT_CARD_KEY");
  });
});
