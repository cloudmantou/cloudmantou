import { describe, expect, it } from "vitest";
import { redeemCard, type RedeemableCard } from "@/lib/card-redemption";

const activeCard: RedeemableCard = {
  id: "card-1",
  cardNo: "CM-VIP-2026",
  cardSecret: "STAR-OPEN",
  type: "VIP_DAYS",
  value: 30,
  status: "ACTIVE",
  expireAt: "2027-01-01T00:00:00.000Z"
};

describe("redeemCard", () => {
  it("redeems an active card immutably", () => {
    const originalCards = [activeCard];
    const now = new Date("2026-06-30T00:00:00.000Z");
    const result = redeemCard(
      originalCards,
      { cardNo: "CM-VIP-2026", cardSecret: "STAR-OPEN", userId: "user-1" },
      now
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.status).toBe("USED");
      expect(result.card.usedBy).toBe("user-1");
      expect(result.cards[0]).not.toBe(originalCards[0]);
    }
    expect(originalCards[0].status).toBe("ACTIVE");
  });

  it("rejects expired cards", () => {
    const result = redeemCard(
      [{ ...activeCard, expireAt: "2025-01-01T00:00:00.000Z" }],
      { cardNo: "CM-VIP-2026", cardSecret: "STAR-OPEN", userId: "user-1" },
      new Date("2026-06-30T00:00:00.000Z")
    );

    expect(result).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects unknown cards", () => {
    const result = redeemCard(
      [activeCard],
      { cardNo: "UNKNOWN", cardSecret: "NOPE", userId: "user-1" },
      new Date("2026-06-30T00:00:00.000Z")
    );

    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("rejects reused cards", () => {
    const result = redeemCard(
      [{ ...activeCard, status: "USED" }],
      { cardNo: "CM-VIP-2026", cardSecret: "STAR-OPEN", userId: "user-1" },
      new Date("2026-06-30T00:00:00.000Z")
    );

    expect(result).toEqual({ ok: false, reason: "INVALID_STATUS" });
  });
});
