import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("@/lib/guards", () => ({ ApiError: class extends Error { constructor(message: string, public code: number, public status: number) { super(message); } } }));
import { licenseJson, licenseMutationSchema, licensePageParams, listLicenses, mutateLicense, parseLicenseApps } from "@/lib/app-licenses";

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
    const result = await listLicenses({ tab, page: 2, search: "' OR 1=1 --", status: "used" }, db);
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
  it("rejects resetting a key with device grants", async () => {
    query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 4 }]);
    await expect(mutateLicense({ action: "card.reset", id: 1 }, db)).rejects.toThrow("请先解除");
    expect(execute).not.toHaveBeenCalled();
  });
  it("allows reuse only after all grants have been removed", async () => {
    query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]);
    await mutateLicense({ action: "card.reset", id: 1 }, db);
    expect(execute.mock.calls[0][0].join("?")).toContain("used=0,used_at=NULL");
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
