import { describe, expect, it } from "vitest";
import { cardVerifySchema } from "@/lib/validators/card";

describe("cardVerifySchema", () => {
  it("normalizes valid card input", () => {
    const result = cardVerifySchema.parse({
      cardNo: "  CM-VIP-2026  ",
      cardSecret: "  STAR-OPEN  "
    });

    expect(result).toEqual({
      cardNo: "CM-VIP-2026",
      cardSecret: "STAR-OPEN"
    });
  });

  it("rejects too-short card input", () => {
    const result = cardVerifySchema.safeParse({
      cardNo: "CM",
      cardSecret: "X"
    });

    expect(result.success).toBe(false);
  });
});
