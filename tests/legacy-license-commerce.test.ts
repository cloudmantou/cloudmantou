import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ old: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn() }, blog: { cardPackage: { findUnique: vi.fn() }, card: { findMany: vi.fn(), createMany: vi.fn(), findUnique: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.blog }));
vi.mock("@/lib/legacy-license-db", async original => ({ ...await original<typeof import("@/lib/legacy-license-db")>(), licenseDb: () => mocks.old }));
vi.mock("@/lib/point-card-crypto", async original => ({ ...await original<typeof import("@/lib/point-card-crypto")>(), hashPointCardSecret: async (key: string) => `test-hash:${key}` }));
import { legacyCardUsable, usableLegacyIds, provisionLegacyStock, protectCommerceLicenseMutation } from "@/lib/legacy-license-commerce";
import { generateLicenseKey } from "@/lib/legacy-license-db";
import { encryptPointCardSecret } from "@/lib/point-card-crypto";
import { decryptCardSecret } from "@/lib/card-secret-storage";
import { countActiveCardStock } from "@/lib/card-packages";
import { buildOrderFulfillment } from "@/lib/order-fulfillment";
const row = { id: 1001, card_key: "LegacySecret1234", used: 0, bound: 0n };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("POINT_CARD_KEY", "commerce-test-key-more-than-32-characters");
  mocks.old.$transaction.mockImplementation(async fn => fn(mocks.old));
  mocks.old.$queryRaw.mockResolvedValue([row]); mocks.old.$executeRaw.mockResolvedValue(1);
  mocks.blog.cardPackage.findUnique.mockResolvedValue({ id: "pkg", deliverySource: "MANTOU_ADMIN", cardType: "GENERIC" });
  mocks.blog.card.findMany.mockResolvedValue([]); mocks.blog.card.findUnique.mockResolvedValue(null); mocks.blog.card.createMany.mockResolvedValue({ count: 1 });
});
describe("real app license stock", () => {
  it("generates old-client compatible random keys and publishes the exact registered key encrypted", async () => {
    const events: string[] = [];
    mocks.old.$queryRaw.mockImplementation(async (strings, key) => { expect(strings.join("?")).toContain("FOR UPDATE"); events.push("old"); return [{ ...row, card_key: key }]; });
    mocks.blog.card.createMany.mockImplementation(async ({ data }) => { events.push("blog"); expect(data[0].legacyCardId).toBe(1001); expect(data[0].status).toBe("ACTIVE"); expect(data[0].type).toBe("GENERIC"); return { count: data.length }; });
    const result = await provisionLegacyStock({ packageId: "pkg", count: 1 });
    const card = mocks.blog.card.createMany.mock.calls[0][0].data[0];
    expect(result.cards[0].cardSecret).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(decryptCardSecret(card.cardSecretEnc)).toBe(result.cards[0].cardSecret);
    expect(card.cardSecretEnc).not.toContain(result.cards[0].cardSecret);
    expect(events).toEqual(["old", "blog"]); expect(generateLicenseKey()).toMatch(/^[A-Za-z0-9]{16}$/);
  });
  it("imports canonical stored keys, deduplicates IDs, skips cards already allocated to another product", async () => {
    const first = await provisionLegacyStock({ packageId: "pkg", count: 2, keys: [" legacysecret1234 ", "LegacySecret1234"], active: false, batchNo: "test" });
    expect(first.count).toBe(1); expect(first.cards[0].cardSecret).toBe(row.card_key);
    expect(mocks.blog.card.createMany.mock.calls[0][0].data[0].status).toBe("DISABLED");
    expect(mocks.old.$executeRaw).not.toHaveBeenCalled();
    mocks.blog.card.findMany.mockResolvedValue([{ legacyCardId: row.id }]); mocks.blog.card.createMany.mockClear();
    expect((await provisionLegacyStock({ packageId: "pkg", count: 1, keys: [row.card_key] })).count).toBe(0);
    expect(mocks.blog.card.createMany).not.toHaveBeenCalled();
  });
  it.each([null, { ...row, used: 1 }, { ...row, bound: 1n }])("rejects missing, used and bound imports before publishing", async invalid => {
    mocks.old.$queryRaw.mockResolvedValue(invalid ? [invalid] : []);
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1, keys: [row.card_key] })).rejects.toMatchObject({ status: 409 });
    expect(mocks.blog.card.createMany).not.toHaveBeenCalled();
  });
  it("leaves valid legacy keys intact if blog persistence is ambiguous; duplicate imports fail safely", async () => {
    mocks.blog.card.createMany.mockRejectedValue(new Error("connection lost secret"));
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1, keys: [row.card_key] })).rejects.toMatchObject({ status: 503, message: expect.stringContaining("入库未完成") });
    expect(mocks.old.$executeRaw).not.toHaveBeenCalled();
  });
  it("validates storage configuration, product source, count and empty/oversized imports before provisioning", async () => {
    for (const input of [{ count: 0 }, { count: 501 }, { count: 1, keys: [] }, { count: 1, keys: [""] }, { count: 1, keys: ["x".repeat(256)] }]) await expect(provisionLegacyStock({ packageId: "pkg", ...input })).rejects.toMatchObject({ status: 422 });
    mocks.blog.cardPackage.findUnique.mockResolvedValue(null);
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1 })).rejects.toMatchObject({ status: 422 });
    mocks.blog.cardPackage.findUnique.mockResolvedValue({ deliverySource: "BLOG" });
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1 })).rejects.toMatchObject({ status: 422 });
    mocks.blog.cardPackage.findUnique.mockResolvedValue({ deliverySource: "MANTOU_ADMIN", cardType: "GENERIC" });
    vi.stubEnv("POINT_CARD_KEY", "");
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1 })).rejects.toThrow("POINT_CARD_KEY");
    expect(mocks.old.$transaction).not.toHaveBeenCalled();
  });
  it("sanitizes legacy failures and never publishes unregistered keys", async () => {
    mocks.old.$transaction.mockRejectedValue(new Error("SQL secret credential"));
    await expect(provisionLegacyStock({ packageId: "pkg", count: 1 })).rejects.toMatchObject({ status: 503, message: "应用授权服务暂时不可用，请稍后重试" });
    expect(mocks.blog.card.createMany).not.toHaveBeenCalled();
  });
});
describe("legacy availability and mutation boundaries", () => {
  it("checks unused state, binding state and exact key identity before delivery", async () => {
    const card = { legacyCardId: row.id, cardSecretEnc: encryptPointCardSecret(row.card_key) };
    await expect(legacyCardUsable({})).resolves.toBe(true);
    await expect(legacyCardUsable({ legacyCardId: row.id })).resolves.toBe(false);
    await expect(legacyCardUsable(card)).resolves.toBe(true);
    for (const invalid of [null, { ...row, used: 1 }, { ...row, bound: 1 }, { ...row, card_key: "different" }]) {
      mocks.old.$queryRaw.mockResolvedValue(invalid ? [invalid] : []); await expect(legacyCardUsable(card)).resolves.toBe(false);
    }
    mocks.old.$queryRaw.mockRejectedValue(new Error("secret"));
    await expect(legacyCardUsable(card)).rejects.toMatchObject({ status: 503 });
  });
  it("batches stock lookups and hides unavailable app stock without blocking other goods", async () => {
    expect(await usableLegacyIds([])).toEqual(new Set());
    mocks.old.$queryRaw.mockResolvedValue([{ id: 1 }]);
    expect(await usableLegacyIds(Array.from({ length: 201 }, (_, i) => i + 1))).toEqual(new Set([1]));
    expect(mocks.old.$queryRaw).toHaveBeenCalledTimes(2);
    const sql = mocks.old.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain("c.used=0"); expect(sql.sql).toContain("NOT EXISTS");
    const db = { card: { count: vi.fn().mockResolvedValue(10), findMany: vi.fn().mockResolvedValue([{ legacyCardId: 1 }, { legacyCardId: null }]) } };
    expect(await countActiveCardStock(db, "pkg", "MANTOU_ADMIN")).toBe(1);
    mocks.old.$queryRaw.mockRejectedValue(new Error("outage"));
    expect(await countActiveCardStock(db, "pkg", "MANTOU_ADMIN")).toBe(0);
    expect(await countActiveCardStock(db, "pkg", "BLOG")).toBe(10);
    expect(await countActiveCardStock({ card: { count: db.card.count } }, "pkg", "MANTOU_ADMIN")).toBe(0);
    await expect(usableLegacyIds([1])).rejects.toMatchObject({ status: 503 });
  });
  it("blocks legacy delete/manual binding for commerce keys and permits unrelated administration", async () => {
    await expect(protectCommerceLicenseMutation({ action: "app.sync" })).resolves.toBeUndefined();
    mocks.blog.card.findUnique.mockResolvedValue({ id: "mirrored" });
    await expect(protectCommerceLicenseMutation({ action: "card.delete", id: row.id })).rejects.toMatchObject({ status: 409 });
    await expect(protectCommerceLicenseMutation({ action: "binding.add", cardKey: row.card_key })).rejects.toMatchObject({ status: 409 });
    mocks.old.$queryRaw.mockResolvedValue([]);
    await expect(protectCommerceLicenseMutation({ action: "binding.add", cardKey: "unknown" })).resolves.toBeUndefined();
  });
  it("keeps app usage instructions and source in owner receipts", () => {
    const result = buildOrderFulfillment({ status: "PAID", productType: "CARD_PACKAGE", delivery: { cardNo: "reference", cardSecretEnc: encryptPointCardSecret(row.card_key), deliverySource: "MANTOU_ADMIN" } });
    expect(result.card).toEqual({ cardNo: "reference", cardSecret: row.card_key, deliverySource: "MANTOU_ADMIN" }); expect(result.message).toContain("App");
  });
});
