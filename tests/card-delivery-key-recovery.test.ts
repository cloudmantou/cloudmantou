import { beforeEach, expect, it, vi } from "vitest";
import { encodeInventoryCardSecret } from "@/lib/card-inventory-crypto";
import { canReadCardSecret, decryptCardSecret, encryptCardSecret } from "@/lib/card-secret-storage";
import { verifyCardSecret } from "@/lib/card-crypto";
import { reserveCardForOrder, CardDeliveryUnavailableError } from "@/lib/card-delivery";
import { countActiveCardStock } from "@/lib/card-packages";
import { buildOrderFulfillment } from "@/lib/order-fulfillment";
import { encryptPointCardSecret } from "@/lib/point-card-crypto";
beforeEach(() => { vi.stubEnv("CARD_DELIVERY_KEY", ""); vi.stubEnv("CARD_SECRET_SALT", ""); vi.stubEnv("POINT_CARD_KEY", "valid-recovery-key-with-more-than-32-characters"); });
it("generates deliverable and redeemable blog inventory with only the actual production key configuration", async () => {
  const { hash, enc } = await encodeInventoryCardSecret("VALID-NEW-CARD");
  expect(enc).toMatch(/^points-v1:/); expect(hash).toMatch(/^points-v1:/); expect(decryptCardSecret(enc)).toBe("VALID-NEW-CARD");
  expect(await verifyCardSecret("VALID-NEW-CARD", hash)).toBe(true); expect(await verifyCardSecret("WRONG", hash)).toBe(false);
});
it("retains support for deployments with only legacy keys and fails if neither storage key is configured", async () => {
  vi.stubEnv("POINT_CARD_KEY", ""); vi.stubEnv("CARD_SECRET_SALT", "existing-legacy-salt");
  const { hash, enc } = await encodeInventoryCardSecret("LEGACY-KEY"); expect(hash).toMatch(/^\$2/); expect(decryptCardSecret(enc)).toBe("LEGACY-KEY");
  vi.stubEnv("CARD_SECRET_SALT", ""); await expect(encodeInventoryCardSecret("ANY")).rejects.toThrow("CARD_SECRET_SALT");
});
it("validates GCM authentication rather than trusting a nonempty ciphertext or a present key", () => {
  expect(canReadCardSecret(null)).toBe(false); expect(canReadCardSecret("corrupt")).toBe(false);
  vi.stubEnv("CARD_SECRET_SALT", "original"); const old = encryptCardSecret("OLD"); expect(canReadCardSecret(old)).toBe(true);
  vi.stubEnv("CARD_SECRET_SALT", "different"); expect(canReadCardSecret(old)).toBe(false);
  vi.stubEnv("CARD_SECRET_SALT", ""); expect(canReadCardSecret(old)).toBe(false);
});
function stockTx(payloads: string[]) {
  const cards = payloads.map((cardSecretEnc, n) => ({ id: String(n), cardNo: `ref-${n}`, cardSecretEnc, packageId: "pkg", status: "ACTIVE" }));
  return { card: { count: vi.fn().mockResolvedValue(cards.length), findFirst: vi.fn().mockImplementation(async ({ where }) => cards.find(c => !where.id?.notIn.includes(c.id)) || null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
}
it("rejects unreadable stock before a new order reserves any card, so payment cannot follow", async () => {
  const tx = stockTx(["undecryptable-old-card"]);
  await expect(reserveCardForOrder(tx as never, { id: "order", productId: "pkg" }, new Date())).rejects.toBeInstanceOf(CardDeliveryUnavailableError);
  expect(tx.card.updateMany).not.toHaveBeenCalled();
});
it("skips a damaged card and reserves a valid versioned card when available", async () => {
  const tx = stockTx(["broken", encryptPointCardSecret("USABLE")]);
  await reserveCardForOrder(tx as never, { id: "order", productId: "pkg" }, new Date());
  expect(tx.card.updateMany).toHaveBeenCalledTimes(1); expect(tx.card.updateMany.mock.calls[0][0].where.id).toBe("1");
});
it("does not advertise legacy stock when its delivery key is missing", async () => {
  const count = vi.fn().mockResolvedValue(0); await countActiveCardStock({ card: { count } }, "pkg", "BLOG");
  expect(count.mock.calls[0][0].where.cardSecretEnc).toEqual({ startsWith: "points-v1:" });
});
it("keeps one unreadable historical receipt from breaking the owner's order list", () => {
  expect(buildOrderFulfillment({ status: "PAID", productType: "CARD_PACKAGE", delivery: { cardNo: "old", cardSecretEnc: "broken" } })).toEqual({ kind: "card", message: "历史卡密暂不可读取，请联系管理员", card: null, unavailable: true });
  expect(buildOrderFulfillment({ status: "PAID", productType: "CARD_PACKAGE", delivery: { cardNo: "new", cardSecretEnc: encryptPointCardSecret("USABLE") } }).card?.cardSecret).toBe("USABLE");
});
