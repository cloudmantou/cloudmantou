import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    siteSetting: { findUnique: vi.fn() },
    pointEntry: { findUnique: vi.fn(), create: vi.fn() },
    user: { update: vi.fn() },
    post: { findUnique: vi.fn() },
    articleFeedback: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    feedbackImage: { findMany: vi.fn(), updateMany: vi.fn() },
    feedbackEvent: { create: vi.fn() },
    pointRedemption: { findUnique: vi.fn(), create: vi.fn() },
    pointReward: { findUnique: vi.fn(), findMany: vi.fn() },
    order: { create: vi.fn() },
    card: { count: vi.fn() },
  };
  return {
    tx,
    prisma: { ...tx, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) },
    deliverCardPackageOrder: vi.fn(),
    decryptCardSecret: vi.fn((value: string) => `plain:${value}`),
  };
});

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/card-delivery", () => ({ deliverCardPackageOrder: mocks.deliverCardPackageOrder }));
vi.mock("@/lib/card-secret-storage", () => ({ decryptCardSecret: mocks.decryptCardSecret }));

import { ApiError } from "@/lib/guards";
import {
  addPointEntry,
  feedbackError,
  feedbackPage,
  feedbackPolicy,
  listPointRewards,
  lockPointsUser,
  pointReceipt,
  redeemPointReward,
  rewardStock,
  submitFeedback,
  updateFeedback,
} from "@/lib/feedback-server";

const { tx } = mocks;
const imageId = "clzzzzzzzzzzzzzzzzzzzzzzzz";
const submission = { kind: "BUG" as const, title: "阅读问题", content: "打开之后无法返回", appVersion: "", environment: "", imageIds: [imageId], allowPublic: true };
const feedbackRow = { id: "fb1", userId: "u1", status: "SUBMITTED", allowPublic: true, published: false, resolvedVersion: null as string | null };

async function rejection(promise: Promise<unknown>) {
  try { await promise; } catch (error) { return error as ApiError; }
  throw new Error("expected rejection");
}

describe("feedback server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: "u1", points: 100 }]);
    tx.siteSetting.findUnique.mockResolvedValue(null);
    tx.pointEntry.findUnique.mockResolvedValue(null);
    tx.articleFeedback.findUniqueOrThrow.mockResolvedValue({ id: "fb1" });
  });

  describe("feedbackPolicy", () => {
    it("falls back to defaults for missing, invalid or malformed settings", async () => {
      expect(await feedbackPolicy()).toEqual({ accepted: 10, completed: 40 });
      tx.siteSetting.findUnique.mockResolvedValueOnce({ value: JSON.stringify({ accepted: -1 }) });
      expect(await feedbackPolicy(tx as never)).toEqual({ accepted: 10, completed: 40 });
      tx.siteSetting.findUnique.mockResolvedValueOnce({ value: "{not json" });
      expect(await feedbackPolicy(tx as never)).toEqual({ accepted: 10, completed: 40 });
    });

    it("uses a valid stored policy", async () => {
      tx.siteSetting.findUnique.mockResolvedValueOnce({ value: JSON.stringify({ accepted: 3, completed: 7 }) });
      expect(await feedbackPolicy(tx as never)).toEqual({ accepted: 3, completed: 7 });
    });
  });

  describe("points ledger", () => {
    it("rejects unknown users when locking", async () => {
      tx.$queryRaw.mockResolvedValueOnce([]);
      expect((await rejection(lockPointsUser(tx as never, "ghost"))).status).toBe(404);
    });

    it("is idempotent per key and writes the balance", async () => {
      tx.pointEntry.findUnique.mockResolvedValueOnce({ id: "existing" });
      expect(await addPointEntry(tx as never, { userId: "u1", key: "k", delta: 5, reason: "r" })).toBe(0);
      expect(tx.user.update).not.toHaveBeenCalled();

      expect(await addPointEntry(tx as never, { userId: "u1", key: "k2", delta: -40, reason: "r" })).toBe(-40);
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { points: 60 } });
      expect(tx.pointEntry.create).toHaveBeenCalledWith({ data: { userId: "u1", key: "k2", delta: -40, reason: "r", balanceAfter: 60 } });
    });

    it("refuses overdrafts and overflowing balances", async () => {
      expect((await rejection(addPointEntry(tx as never, { userId: "u1", key: "k", delta: -101, reason: "r" }))).status).toBe(409);
      expect((await rejection(addPointEntry(tx as never, { userId: "u1", key: "k", delta: 2147483647, reason: "r" }))).status).toBe(409);
      expect((await rejection(addPointEntry(tx as never, { userId: "u1", key: "k", delta: 0.5, reason: "r" }))).status).toBe(409);
    });
  });

  describe("submitFeedback", () => {
    beforeEach(() => {
      tx.post.findUnique.mockResolvedValue({ status: "PUBLISHED" });
      tx.articleFeedback.count.mockResolvedValue(0);
      tx.feedbackImage.findMany.mockResolvedValue([{ id: imageId }]);
      tx.articleFeedback.create.mockResolvedValue({ id: "fb1" });
    });

    it("creates feedback, claims screenshots and records the first event", async () => {
      await expect(submitFeedback("p1", "u1", submission)).resolves.toEqual({ id: "fb1" });
      const { imageIds: _ignored, ...fields } = submission;
      expect(tx.articleFeedback.create).toHaveBeenCalledWith({ data: { ...fields, postId: "p1", userId: "u1" } });
      expect(tx.feedbackImage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { feedbackId: "fb1" } }));
      expect(tx.feedbackEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ feedbackId: "fb1", status: "SUBMITTED" }) });
    });

    it("skips screenshot claiming when none are attached", async () => {
      tx.feedbackImage.findMany.mockResolvedValueOnce([]);
      await submitFeedback("p1", "u1", { ...submission, imageIds: [] });
      expect(tx.feedbackImage.updateMany).not.toHaveBeenCalled();
    });

    it("rejects missing or draft posts, daily limits and foreign screenshots", async () => {
      tx.post.findUnique.mockResolvedValueOnce(null);
      expect((await rejection(submitFeedback("p1", "u1", submission))).status).toBe(404);
      tx.post.findUnique.mockResolvedValueOnce({ status: "DRAFT" });
      expect((await rejection(submitFeedback("p1", "u1", submission))).status).toBe(404);
      tx.articleFeedback.count.mockResolvedValueOnce(5);
      expect((await rejection(submitFeedback("p1", "u1", submission))).status).toBe(429);
      tx.feedbackImage.findMany.mockResolvedValueOnce([]);
      expect((await rejection(submitFeedback("p1", "u1", submission))).status).toBe(422);
      expect(tx.articleFeedback.create).not.toHaveBeenCalled();
    });
  });

  describe("updateFeedback", () => {
    const update = { status: "COMPLETED" as const, note: "已修复", resolvedVersion: "1.2.0", published: true };

    it("awards every reached milestone and records the transition", async () => {
      tx.articleFeedback.findUnique.mockResolvedValueOnce({ ...feedbackRow, status: "IN_PROGRESS" });
      await updateFeedback("fb1", "admin", update);
      expect(tx.pointEntry.create).toHaveBeenCalledTimes(2);
      expect(tx.pointEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ key: "feedback:fb1:accepted", reason: "反馈被采纳", delta: 10 }) });
      expect(tx.pointEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ key: "feedback:fb1:completed", reason: "反馈开发完成", delta: 40 }) });
      expect(tx.articleFeedback.update).toHaveBeenCalledWith({ where: { id: "fb1" }, data: { status: "COMPLETED", published: true, resolvedVersion: "1.2.0" } });
      expect(tx.feedbackEvent.create).toHaveBeenCalledWith({ data: { feedbackId: "fb1", actorId: "admin", status: "COMPLETED", note: "已修复", awardedPoints: 50 } });
    });

    it("records display-only changes with a default note and skips no-op saves", async () => {
      tx.articleFeedback.findUnique.mockResolvedValueOnce({ ...feedbackRow, resolvedVersion: "1.0" });
      await updateFeedback("fb1", "admin", { status: "SUBMITTED", note: "", resolvedVersion: "", published: true });
      expect(tx.articleFeedback.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolvedVersion: null }) }));
      expect(tx.feedbackEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ note: "开发者更新了反馈显示设置", awardedPoints: 0 }) });

      tx.feedbackEvent.create.mockClear();
      tx.articleFeedback.findUnique.mockResolvedValueOnce(feedbackRow);
      await updateFeedback("fb1", "admin", { status: "SUBMITTED", note: "", resolvedVersion: "", published: false });
      expect(tx.feedbackEvent.create).not.toHaveBeenCalled();
    });

    it("rejects missing rows, illegal transitions, private publishing and silent status changes", async () => {
      tx.articleFeedback.findUnique.mockResolvedValueOnce(null);
      expect((await rejection(updateFeedback("fb1", "admin", update))).status).toBe(404);
      tx.articleFeedback.findUnique.mockResolvedValueOnce({ ...feedbackRow, status: "COMPLETED" });
      expect((await rejection(updateFeedback("fb1", "admin", { ...update, status: "SUBMITTED" }))).status).toBe(409);
      tx.articleFeedback.findUnique.mockResolvedValueOnce({ ...feedbackRow, allowPublic: false });
      expect((await rejection(updateFeedback("fb1", "admin", { ...update, status: "SUBMITTED" }))).status).toBe(409);
      tx.articleFeedback.findUnique.mockResolvedValueOnce(feedbackRow);
      expect((await rejection(updateFeedback("fb1", "admin", { ...update, status: "ACCEPTED", note: "" }))).status).toBe(422);
    });
  });

  describe("redeemPointReward", () => {
    const reward = { id: "r1", enabled: true, cost: 30, packageId: "pkg1", package: { enabled: true, name: "月卡" } };

    beforeEach(() => {
      tx.pointRedemption.findUnique.mockResolvedValue(null);
      tx.pointReward.findUnique.mockResolvedValue(reward);
      tx.order.create.mockResolvedValue({ id: "o1" });
      tx.pointRedemption.create.mockResolvedValue({ id: "red1" });
    });

    it("debits points, creates a paid order and delivers a card", async () => {
      await expect(redeemPointReward("u1", "r1", "req")).resolves.toEqual({ id: "red1" });
      expect(tx.pointEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ key: "redeem:u1:req", delta: -30, balanceAfter: 70 }) });
      expect(tx.order.create).toHaveBeenCalledWith({ data: expect.objectContaining({ productId: "pkg1", amount: 0, status: "PAID", title: "积分兑换 · 月卡" }) });
      expect(mocks.deliverCardPackageOrder).toHaveBeenCalledWith(tx, { id: "o1" });
      expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 20000 });
    });

    it("replays an existing request but refuses a swapped reward", async () => {
      tx.pointRedemption.findUnique.mockResolvedValueOnce({ id: "red0", rewardId: "r1" });
      await expect(redeemPointReward("u1", "r1", "req")).resolves.toEqual({ id: "red0", rewardId: "r1" });
      tx.pointRedemption.findUnique.mockResolvedValueOnce({ id: "red0", rewardId: "other" });
      expect((await rejection(redeemPointReward("u1", "r1", "req"))).status).toBe(409);
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it("refuses missing or disabled rewards and packages", async () => {
      for (const row of [null, { ...reward, enabled: false }, { ...reward, package: { ...reward.package, enabled: false } }]) {
        tx.pointReward.findUnique.mockResolvedValueOnce(row);
        expect((await rejection(redeemPointReward("u1", "r1", "req"))).code).toBe(40900);
      }
    });

    it("maps stock failures to conflicts and other delivery failures to unavailable", async () => {
      mocks.deliverCardPackageOrder.mockRejectedValueOnce(new Error("库存不足"));
      const stock = await rejection(redeemPointReward("u1", "r1", "req"));
      expect([stock.code, stock.status]).toEqual([40900, 409]);
      mocks.deliverCardPackageOrder.mockRejectedValueOnce(new Error("decrypt failed"));
      const broken = await rejection(redeemPointReward("u1", "r1", "req"));
      expect([broken.code, broken.status]).toEqual([50300, 503]);
      mocks.deliverCardPackageOrder.mockRejectedValueOnce("boom");
      expect((await rejection(redeemPointReward("u1", "r1", "req"))).status).toBe(503);
    });
  });

  it("builds receipts with decrypted card secrets", () => {
    const createdAt = new Date("2026-01-01");
    expect(pointReceipt({ id: "red1", cost: 30, createdAt, order: { delivery: { cardNo: "C1", cardSecretEnc: "enc" } } }))
      .toEqual({ id: "red1", cost: 30, createdAt, card: { cardNo: "C1", cardSecret: "plain:enc" } });
    expect(pointReceipt({ id: "red1", cost: 30, createdAt, order: { delivery: null } }).card).toBeNull();
  });

  it("lists rewards with live stock for public and admin views", async () => {
    tx.card.count.mockResolvedValue(4);
    tx.pointReward.findMany.mockResolvedValue([{ id: "r1", cost: 30, enabled: true, packageId: "pkg1", package: { name: "月卡", description: "d", redemptionNote: "n", cardType: "MEMBERSHIP", cardValue: 30 } }]);
    expect(await listPointRewards()).toEqual([{ id: "r1", cost: 30, enabled: true, name: "月卡", description: "d", note: "n", type: "MEMBERSHIP", value: 30, stock: 4 }]);
    expect(tx.pointReward.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { enabled: true, package: { enabled: true } } }));
    await listPointRewards(true);
    expect(tx.pointReward.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));
    expect(await rewardStock("pkg1")).toBe(4);
  });

  it("clamps the page query", () => {
    const page = (query: string) => feedbackPage({ nextUrl: new URL(`https://example.test/feedback${query}`) });
    expect(page("")).toBe(1);
    expect(page("?page=3")).toBe(3);
    expect(page("?page=-4")).toBe(1);
    expect(page("?page=99999")).toBe(10000);
    expect(page("?page=abc")).toBe(1);
  });

  it("maps errors to safe API responses", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(feedbackError(new ApiError("nope", 40900, 409))).toEqual({ message: "nope", code: 40900, status: 409 });
    expect(feedbackError(new SyntaxError("bad json"))).toMatchObject({ code: 42200, status: 422 });
    expect(feedbackError(new TypeError("x"))).toMatchObject({ code: 50000, status: 500 });
    expect(feedbackError("weird")).toMatchObject({ code: 50000 });
    expect(consoleError).toHaveBeenCalledWith("[Feedback]", "TypeError");
    expect(consoleError).toHaveBeenCalledWith("[Feedback]", "unknown");
    consoleError.mockRestore();
  });
});
