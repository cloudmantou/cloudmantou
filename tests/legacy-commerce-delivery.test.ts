import { beforeEach, expect, it, vi } from "vitest";
const old = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/legacy-license-db", () => ({ licenseDb: () => old }));
import { deliverCardPackageOrder, reserveCardForOrder } from "@/lib/card-delivery";
import { encryptPointCardSecret } from "@/lib/point-card-crypto";
import { decryptCardSecret } from "@/lib/card-secret-storage";
const order = { id: "order", userId: "owner", productType: "CARD_PACKAGE", productId: "pkg" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("POINT_CARD_KEY", "commerce-delivery-test-key-longer-than-32"); });
function fixture() {
  const cards = [1, 2].map(n => ({ id: `blog-${n}`, legacyCardId: n, cardNo: `ref-${n}`, cardSecretEnc: encryptPointCardSecret(`old-key-${n}`), packageId: "pkg", status: "ACTIVE", expireAt: null }));
  const tx = { orderDelivery: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, cardPackage: { findUnique: vi.fn().mockResolvedValue({ id: "pkg", deliverySource: "MANTOU_ADMIN" }) }, card: { findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(2), findFirst: vi.fn().mockImplementation(async ({ where }) => cards.find(c => !where.id?.notIn?.includes(c.id))), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
  old.$queryRaw.mockImplementation(async (_sql, id) => [{ id, card_key: `old-key-${id}`, used: id === 1 ? 1 : 0, bound: 0 }]);
  return { cards, tx };
}
it("skips keys already consumed by old clients, atomically claims another and persists its usage source", async () => {
  const { tx } = fixture();
  const result = await deliverCardPackageOrder(tx as never, order);
  expect(result?.cardSecret).toBe("old-key-2");
  const record = tx.orderDelivery.create.mock.calls[0][0].data;
  expect(record.deliverySource).toBe("MANTOU_ADMIN"); expect(decryptCardSecret(record.cardSecretEnc)).toBe("old-key-2");
  expect(tx.card.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.card.updateMany.mock.calls[0][0].where.legacyCardId).toEqual({ not: null });
});
it("replaces a reserved key used externally and does not revalidate an already delivered receipt", async () => {
  const { tx, cards } = fixture(); tx.card.findUnique.mockResolvedValue(cards[0]);
  await deliverCardPackageOrder(tx as never, order);
  expect(tx.card.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: cards[0].id, orderId: order.id }, data: { orderId: null } });
  tx.orderDelivery.findUnique.mockResolvedValue({ cardNo: "saved", cardSecretEnc: cards[0].cardSecretEnc, status: "DELIVERED" }); old.$queryRaw.mockClear();
  expect((await deliverCardPackageOrder(tx as never, order))?.cardSecret).toBe("old-key-1"); expect(old.$queryRaw).not.toHaveBeenCalled();
});
it("fails before allocating stock or delivery if the authorization database is unavailable", async () => {
  const { tx } = fixture(); old.$queryRaw.mockRejectedValue(new Error("database offline"));
  await expect(reserveCardForOrder(tx as never, { id: order.id, productId: "pkg" }, new Date(), "MANTOU_ADMIN")).rejects.toMatchObject({ status: 503 });
  expect(tx.card.updateMany).not.toHaveBeenCalled(); expect(tx.orderDelivery.create).not.toHaveBeenCalled();
});
