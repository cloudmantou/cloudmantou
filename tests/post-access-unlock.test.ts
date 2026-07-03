import { describe, expect, it } from "vitest";
import { normalizeAlipayEnv } from "@/lib/payment-config";

describe("normalizeAlipayEnv", () => {
  it("maps legacy Chinese labels and canonical values", () => {
    expect(normalizeAlipayEnv("sandbox")).toBe("sandbox");
    expect(normalizeAlipayEnv("沙箱环境")).toBe("sandbox");
    expect(normalizeAlipayEnv("production")).toBe("production");
    expect(normalizeAlipayEnv("正式环境")).toBe("production");
    expect(normalizeAlipayEnv(undefined)).toBe("production");
  });
});