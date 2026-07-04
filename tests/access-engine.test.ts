import { describe, expect, it } from "vitest";
import { commentCountDelta } from "@/lib/comment-count";
import { toLegacyReason, toLegacyResult } from "@/lib/access/types";
import { isOrderExpiredByAge, ORDER_PENDING_TTL_MS } from "@/lib/order-lifecycle";

describe("access engine legacy mapping", () => {
  it("maps unified grant reasons to legacy post-access reasons", () => {
    expect(toLegacyReason("PUBLIC")).toBe("published");
    expect(toLegacyReason("VIP")).toBe("vip_active");
    expect(toLegacyReason("POST_ENTITLEMENT")).toBe("paid_post_entitled");
    expect(toLegacyReason("ARTICLE_CREDIT_AVAILABLE")).toBe("article_credit_available");
    expect(toLegacyReason("NONE")).toBe("no_access");
  });

  it("maps access decision to legacy result without auto-granting credit pool", () => {
    const legacy = toLegacyResult({
      allowed: false,
      reason: "ARTICLE_CREDIT_AVAILABLE",
      requiresUnlock: true,
      content: null,
      articleCreditsAvailable: 2,
    });

    expect(legacy.hasAccess).toBe(false);
    expect(legacy.reason).toBe("article_credit_available");
    expect(legacy.articleCreditsAvailable).toBe(2);
  });
});

describe("comment count delta", () => {
  it("increments only when becoming approved", () => {
    expect(commentCountDelta("PENDING", "APPROVED")).toBe(1);
    expect(commentCountDelta("REJECTED", "APPROVED")).toBe(1);
    expect(commentCountDelta("APPROVED", "REJECTED")).toBe(-1);
    expect(commentCountDelta("PENDING", "REJECTED")).toBe(0);
    expect(commentCountDelta("APPROVED", "APPROVED")).toBe(0);
  });
});

describe("order pending ttl", () => {
  it("marks orders older than ttl as expired", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const createdAt = new Date(now.getTime() - ORDER_PENDING_TTL_MS - 1);
    expect(isOrderExpiredByAge(createdAt, now)).toBe(true);
    expect(isOrderExpiredByAge(now, now)).toBe(false);
  });
});