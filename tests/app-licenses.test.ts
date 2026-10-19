import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("@/lib/guards", () => ({ ApiError: class extends Error { constructor(message: string, public code: number, public status: number) { super(message); } } }));
import { expireLicenseBindings, getBindingTtlDays, getBindingExpiryAfterId, licenseJson, licenseMutationSchema, licensePageParams, listLicenses, mutateLicense, parseLicenseApps, setBindingTtlDays } from "@/lib/app-licenses";

const query = vi.fn(), execute = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({ $queryRaw: query, $executeRaw: execute }));
const db = { $queryRaw: query, $executeRaw: execute, $transaction: transaction } as unknown as PrismaClient;
beforeEach(() => { vi.clearAllMocks(); query.mockReset(); execute.mockReset(); execute.mockResolvedValue(1); });

describe("legacy application license validation", () => {
  it("bounds generation, search and pagination and rejects mass assignment", () => {
    expect(licenseMutationSchema.safeParse({ action: "card.generate", count: 501 }).success).toBe(false);
    expect(licenseMutationSchema.safeParse({ action: "card.generate", count: 0 }).success).toBe(false);
    expect(licenseMutationSchema.safeParse({ action: "card.generate", count: 2, role: "ADMIN" }).success).toBe(false);
    expect(() => licensePageParams(new URLSearchParams("page=NaN"))).toThrow();
    expect(() => licensePageParams(new URLSearchParams("tab=users"))).toThrow();
    expect(licensePageParams(new URLSearchParams())).toEqual({ tab: "apps", page: 1, search: "", status: "all" });
  });
  it("disallows executable app links and trims imported secrets", () => {
    expect(licenseMutationSchema.safeParse({ action: "app.save", id: "1", name: "App", version: "", identifier: "", plist: "javascript:alert(1)", pkg: "", requiresKey: true }).success).toBe(false);
    expect(licenseMutationSchema.parse({ action: "card.import", cards: [" abc "] })).toEqual({ action: "card.import", cards: ["abc"] });
  });
  it("normalizes bigint counts and timestamps without modifying values", () => {
    expect(licenseJson({ n: 400n, rows: [{ date: new Date("2026-01-01T00:00:00Z"), value: null }] })).toEqual({ n: 400, rows: [{ date: "2026-01-01T00:00:00.000Z", value: null }] });
  });
  it("selects current history records and rejects broken source data", () => {
    const older = { id: "old", name: "old" }, current = { id: "new", name: "new", current: true };
    expect(parseLicenseApps({ list: [{ history: [older, current] }] })[0].id).toBe("new");
    expect(parseLicenseApps([{ history: [older] }])[0].id).toBe("old");
    expect(parseLicenseApps([{ ...current }])[0].name).toBe("new");
    expect(() => parseLicenseApps({ error: "offline" })).toThrow();
    expect(() => parseLicenseApps([null])).toThrow();
  });
});

describe("shared database reads and mutations", () => {
  it.each(["apps", "cards", "bindings"] as const)("paginates %s and parameterizes hostile searches", async tab => {
    query.mockResolvedValueOnce([{ apps: 8n, cards: 995n, available: 600n, bindings: 400n }]).mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ n: 995n }]);
    const result = await listLicenses({ tab, page: 2, search: "' OR 1=1 --", status: "used" }, db, 30, 0);
    expect(result).toMatchObject({ page: 2, total: 995, stats: { cards: 995 } });
    const statement = query.mock.calls[1][0];
    expect(statement.sql).not.toContain("' OR 1=1");
    expect(statement.values).toContain("%' OR 1=1 --%");
    expect(statement.values).toContain(30);
  });
  it("generates distinct cryptographic keys transactionally", async () => {
    const result = await mutateLicense({ action: "card.generate", count: 30 }, db);
    expect(result).toHaveProperty("cards");
    const cards = result.cards!;
    expect(new Set(cards).size).toBe(30);
    expect(cards.every(v => /^[0-9A-Za-z]{16}$/.test(v))).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(30);
  });
  it("skips imported duplicates without changing existing card usage", async () => {
    execute.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const result = await mutateLicense({ action: "card.import", cards: ["old", "old", "new"] }, db);
    expect(result).toMatchObject({ cards: ["new"] });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0].join("?")).toContain("INSERT IGNORE");
  });
  it("locks and checks a card before binding and marks it used in the same transaction", async () => {
    query.mockResolvedValueOnce([{ id: 9, used: 0 }]).mockResolvedValueOnce([]);
    await mutateLicense({ action: "binding.add", udid: "DEVICE-1", cardKey: "key" }, db);
    expect(query.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
    expect(execute.mock.calls[0][0].join("?")).toContain("INSERT INTO bindings");
    expect(execute.mock.calls[1][0].join("?")).toContain("used=1");
  });
  it.each([{ rows: [] }, { rows: [{ id: 1, used: 1 }] }])("rejects unavailable cards", async ({ rows }) => {
    query.mockResolvedValueOnce(rows);
    await expect(mutateLicense({ action: "binding.add", udid: "DEVICE", cardKey: "used" }, db)).rejects.toThrow("卡密不存在或已使用");
    expect(execute).not.toHaveBeenCalled();
  });
  it("does not reassign an existing authorized device", async () => {
    query.mockResolvedValueOnce([{ id: 1, used: 0 }]).mockResolvedValueOnce([{ id: 3 }]);
    await expect(mutateLicense({ action: "binding.add", udid: "DEVICE", cardKey: "unused" }, db)).rejects.toThrow("此设备已有授权");
    expect(execute).not.toHaveBeenCalled();
  });
  it("deletes all grants before deleting a key transactionally", async () => {
    query.mockResolvedValueOnce([{ id: 1 }]);
    await mutateLicense({ action: "card.delete", id: 1 }, db);
    expect(execute.mock.calls[0][0].join("?")).toContain("DELETE FROM bindings");
    expect(execute.mock.calls[1][0].join("?")).toContain("DELETE FROM cards");
  });
  it("removing a grant does not silently reactivate its secret", async () => {
    await mutateLicense({ action: "binding.delete", id: 1 }, db);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].join("?")).not.toContain("UPDATE cards");
  });
  it("reports missing records and preserves a missing app's state", async () => {
    query.mockResolvedValueOnce([]);
    await expect(mutateLicense({ action: "app.require-key", id: "missing", requiresKey: false }, db)).rejects.toThrow("记录不存在");
    execute.mockResolvedValue(0);
    await expect(mutateLicense({ action: "binding.delete", id: 1 }, db)).rejects.toThrow("记录不存在");
  });
});

const sqlOf = (call: unknown[]) => (call[0] as string[]).join("?");
const settingStore = (value?: string) => ({ siteSetting: { findUnique: vi.fn().mockResolvedValue(value === undefined ? null : { value }), upsert: vi.fn().mockResolvedValue({}) } });

describe("binding expiry and batch unbinding", () => {
  it("computes the bindings countdown with the database clock", async () => {
    query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{ id: 1, expires_in: 86400n }]).mockResolvedValueOnce([{ n: 1n }]);
    const result = await listLicenses({ tab: "bindings", page: 1, search: "", status: "all" }, db, 30, 0);
    expect(result).toMatchObject({ bindingTtlDays: 30, rows: [{ expires_in: 86400 }] });
    expect(query.mock.calls[1][0].sql).toContain("TIMESTAMPDIFF(SECOND,NOW(),b.created_at + INTERVAL ? DAY)");
    query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: 0n }]);
    await listLicenses({ tab: "bindings", page: 1, search: "", status: "all" }, db, 0, 0);
    expect(query.mock.calls[4][0].sql).toContain("NULL expires_in");
  });
  it("batch-unbinds deduplicated rows in one transaction with the single-unbind statement", async () => {
    execute.mockResolvedValueOnce(2);
    const result = await mutateLicense({ action: "binding.delete-batch", ids: [3, 4, 4, 5] }, db);
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(sqlOf(execute.mock.calls[0])).toContain("DELETE FROM bindings WHERE id IN");
    expect(sqlOf(execute.mock.calls[0])).not.toContain("UPDATE cards");
    expect(result.message).toContain("已解除 2 台");
    expect(result.message).toContain("1 条记录已不存在");
    await mutateLicense({ action: "binding.delete", id: 7 }, db);
    expect(sqlOf(execute.mock.calls[1])).toBe(sqlOf(execute.mock.calls[0]));
  });
  it("caps batch size and rejects invalid ids", () => {
    expect(licenseMutationSchema.safeParse({ action: "binding.delete-batch", ids: Array.from({ length: 100 }, (_, i) => i + 1) }).success).toBe(true);
    expect(licenseMutationSchema.safeParse({ action: "binding.delete-batch", ids: Array.from({ length: 101 }, (_, i) => i + 1) }).success).toBe(false);
    expect(licenseMutationSchema.safeParse({ action: "binding.delete-batch", ids: [0] }).success).toBe(false);
    expect(licenseMutationSchema.safeParse({ action: "binding.ttl", days: 1.5 }).success).toBe(false);
  });
  it("expires bindings in bounded batches and re-checks age when deleting", async () => {
    query.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]).mockResolvedValueOnce([{ id: 3n }]);
    execute.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const result = await expireLicenseBindings({ db, afterId: 0, ttlDays: 30, batchSize: 2 });
    expect(result).toEqual({ ttlDays: 30, removed: 3, batches: 2, more: false });
    expect(sqlOf(query.mock.calls[0])).toContain("created_at < NOW() - INTERVAL ? DAY");
    expect(query.mock.calls[0].slice(1)).toEqual([0, 30, 2]);
    const del = execute.mock.calls[0];
    expect(sqlOf(del)).toContain("DELETE FROM bindings WHERE id IN");
    expect(JSON.stringify(del.slice(1))).toContain("created_at < NOW() - INTERVAL");
    expect(sqlOf(del)).not.toContain("UPDATE cards");
  });
  it("stops after the batch limit and reports remaining work", async () => {
    query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    execute.mockResolvedValue(2);
    expect(await expireLicenseBindings({ db, afterId: 0, ttlDays: 30, batchSize: 2, maxBatches: 3 })).toEqual({ ttlDays: 30, removed: 6, batches: 3, more: true });
  });
  it("stops when nothing is due and does nothing when disabled", async () => {
    query.mockResolvedValueOnce([]);
    expect(await expireLicenseBindings({ db, afterId: 0, ttlDays: 30 })).toMatchObject({ removed: 0, batches: 0 });
    expect(await expireLicenseBindings({ db, afterId: 0, ttlDays: 0 })).toMatchObject({ removed: 0 });
    expect(query).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });
  it("reads the period from site settings with a 30-day default", async () => {
    expect(await getBindingTtlDays(settingStore())).toBe(30);
    expect(await getBindingTtlDays(settingStore("45"))).toBe(45);
    expect(await getBindingTtlDays(settingStore("0"))).toBe(0);
    expect(await getBindingTtlDays(settingStore("abc"))).toBe(30);
    expect(await getBindingTtlDays(settingStore("99999"))).toBe(30);
    const store = policyStore();
    query.mockResolvedValueOnce([{ maxId: 605 }]);
    await setBindingTtlDays(14, store, db);
    expect(store.siteSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: "14" } }));
  });
});

function policyStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, siteSetting: {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => values.has(where.key) ? { value: values.get(where.key)! } : null),
    upsert: vi.fn(async ({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value?: string } }) => {
      if (!values.has(where.key)) values.set(where.key, create.value);
      else if (update.value !== undefined) values.set(where.key, update.value);
      return { value: values.get(where.key)! };
    }),
  } };
}
describe("permanent historical device grants", () => {
  it("does not delete anything until the historical baseline has been initialized", async () => {
    expect(await expireLicenseBindings({ db, ttlDays: 30, afterId: null })).toMatchObject({ removed: 0, skipped: expect.any(String) });
    expect(query).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
  });
  it("keeps an immutable baseline across TTL changes and disabling/re-enabling", async () => {
    const store = policyStore(); query.mockResolvedValueOnce([{ maxId: 605n }]);
    await setBindingTtlDays(30, store, db);
    expect(await getBindingExpiryAfterId(store)).toBe(605);
    await setBindingTtlDays(14, store, db); await setBindingTtlDays(0, store, db); await setBindingTtlDays(60, store, db);
    expect(await getBindingExpiryAfterId(store)).toBe(605);
    expect(query).toHaveBeenCalledOnce();
    expect(store.siteSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "appLicenses.bindingExpiryAfterId" }, update: {}, create: expect.objectContaining({ value: "605" }) }));
  });
  it("limits both candidate selection and final deletion to new binding IDs", async () => {
    query.mockResolvedValueOnce([{ id: 606 }]); execute.mockResolvedValueOnce(1);
    expect(await expireLicenseBindings({ db, ttlDays: 30, afterId: 605 })).toMatchObject({ removed: 1 });
    expect(sqlOf(query.mock.calls[0])).toContain("WHERE id > ? AND created_at");
    expect(query.mock.calls[0][1]).toBe(605);
    expect(JSON.stringify(execute.mock.calls[0])).toContain("AND id >");
  });
  it("shows historical rows without a countdown", async () => {
    query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{ id: 605, expires_in: null }, { id: 606, expires_in: 86400 }]).mockResolvedValueOnce([{ n: 2n }]);
    expect(await listLicenses({ tab: "bindings", page: 1, search: "", status: "all" }, db, 30, 605)).toMatchObject({ bindingExpiryAfterId: 605, rows: [{ id: 605, expires_in: null }, { id: 606, expires_in: 86400 }] });
    expect(query.mock.calls[1][0].sql).toContain("CASE WHEN b.id > ?");
  });
});
