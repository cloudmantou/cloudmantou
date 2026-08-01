import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    vip: false,
    postEntitlement: null as { id: string } | null,
    articleCredit: null as { id: string } | null,
    articleCredits: 0,
    post: { status: "PAID_ONLY" } as { status: string } | null,
    updateCount: 1,
    paidContent: null as { price: unknown } | null,
  };

  return {
    state,
    hasActiveMembership: vi.fn(async () => state.vip),
    entitlementFindFirst: vi.fn(async (args: { where?: { postId?: string | null } }) =>
      args.where?.postId === null ? state.articleCredit : state.postEntitlement
    ),
    entitlementCount: vi.fn(async () => state.articleCredits),
    entitlementUpdateMany: vi.fn(async () => ({ count: state.updateCount })),
    postFindUnique: vi.fn(async () => state.post),
    paidContentFindUnique: vi.fn(async () => state.paidContent),
    transaction: vi.fn(),
  };
});

vi.mock("@/lib/membership-service", () => ({
  hasActiveMembership: mocks.hasActiveMembership,
}));

vi.mock("@/lib/prisma", () => {
  const transactionClient = {
    entitlement: {
      findFirst: mocks.entitlementFindFirst,
      updateMany: mocks.entitlementUpdateMany,
    },
  };

  return {
    prisma: {
      entitlement: {
        findFirst: mocks.entitlementFindFirst,
        count: mocks.entitlementCount,
      },
      post: { findUnique: mocks.postFindUnique },
      paidContent: { findUnique: mocks.paidContentFindUnique },
      $transaction: mocks.transaction.mockImplementation(
        async (callback: (tx: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      ),
    },
  };
});

import {
  countArticleCredits,
  decidePostAccess,
  getPostPrice,
  hasActiveVip,
  hasPostEntitlement,
  unlockPostWithArticleCredit,
} from "@/lib/access";
import { getPostAccess } from "@/lib/post-access";

const NOW = new Date("2026-07-19T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.state, {
    vip: false,
    postEntitlement: null,
    articleCredit: null,
    articleCredits: 0,
    post: { status: "PAID_ONLY" },
    updateCount: 1,
    paidContent: null,
  });
});

describe("entitlement production queries", () => {
  it("delegates VIP authority to the membership service", async () => {
    mocks.state.vip = true;

    await expect(hasActiveVip("user-1", NOW)).resolves.toBe(true);
    expect(mocks.hasActiveMembership).toHaveBeenCalledWith("user-1", NOW);
  });

  it("checks a live post entitlement with the supplied decision time", async () => {
    mocks.state.postEntitlement = { id: "entitlement-1" };

    await expect(hasPostEntitlement("user-1", "post-1", NOW)).resolves.toBe(true);
    expect(mocks.entitlementFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "PAID_POST",
        postId: "post-1",
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
      select: { id: true },
    });

    mocks.state.postEntitlement = null;
    await expect(hasPostEntitlement("user-1", "post-1", NOW)).resolves.toBe(false);
  });

  it("counts only unbound, live article credits", async () => {
    mocks.state.articleCredits = 3;

    await expect(countArticleCredits("user-1", NOW)).resolves.toBe(3);
    expect(mocks.entitlementCount).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "PAID_POST",
        postId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
    });
  });
});

describe("read-only post access decisions", () => {
  const base = {
    userId: "user-1",
    postId: "post-1",
    publicContent: "公开部分",
    paidContent: "付费部分",
    status: "PAID_ONLY",
  };

  it("returns public content without querying entitlements", async () => {
    await expect(decidePostAccess({ ...base, status: "PUBLISHED" })).resolves.toEqual({
      allowed: true,
      reason: "PUBLIC",
      requiresUnlock: false,
      content: "公开部分",
    });
    expect(mocks.hasActiveMembership).not.toHaveBeenCalled();
  });

  it("denies drafts and anonymous paid posts without querying rights", async () => {
    await expect(decidePostAccess({ ...base, status: "DRAFT" })).resolves.toMatchObject({
      allowed: false,
      reason: "NONE",
    });
    await expect(decidePostAccess({ ...base, userId: null })).resolves.toMatchObject({
      allowed: false,
      reason: "NONE",
    });
    expect(mocks.hasActiveMembership).not.toHaveBeenCalled();
  });

  it("prioritizes active VIP access and joins public and paid content", async () => {
    mocks.state.vip = true;
    mocks.state.postEntitlement = { id: "entitlement-1" };
    mocks.state.articleCredits = 2;

    await expect(decidePostAccess(base)).resolves.toEqual({
      allowed: true,
      reason: "VIP",
      requiresUnlock: false,
      content: "公开部分\n\n付费部分",
    });
  });

  it("falls back from VIP to a post-bound entitlement", async () => {
    mocks.state.postEntitlement = { id: "entitlement-1" };

    await expect(decidePostAccess({ ...base, paidContent: null })).resolves.toEqual({
      allowed: true,
      reason: "POST_ENTITLEMENT",
      requiresUnlock: false,
      content: "公开部分\n\n",
    });
  });

  it("reports available credits without consuming them", async () => {
    mocks.state.articleCredits = 2;

    await expect(decidePostAccess(base)).resolves.toEqual({
      allowed: false,
      reason: "ARTICLE_CREDIT_AVAILABLE",
      requiresUnlock: true,
      content: null,
      articleCreditsAvailable: 2,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies access when no grant applies", async () => {
    await expect(decidePostAccess(base)).resolves.toEqual({
      allowed: false,
      reason: "NONE",
      requiresUnlock: false,
      content: null,
    });
  });
});

describe("explicit article-credit unlock", () => {
  it("rejects missing and non-paid posts before checking rights", async () => {
    mocks.state.post = null;
    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "not_paid_post",
    });

    mocks.state.post = { status: "PUBLISHED" };
    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "not_paid_post",
    });
  });

  it("does not consume credit for an active VIP or an already unlocked post", async () => {
    mocks.state.vip = true;
    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "already_entitled",
    });

    mocks.state.vip = false;
    mocks.state.postEntitlement = { id: "entitlement-1" };
    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "already_entitled",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns no_credit when the transaction cannot find an available credit", async () => {
    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "no_credit",
    });
  });

  it("detects a concurrent claim through the conditional update count", async () => {
    mocks.state.articleCredit = { id: "credit-1" };
    mocks.state.updateCount = 0;

    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: false,
      reason: "concurrent_conflict",
    });
    expect(mocks.entitlementUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "credit-1",
        userId: "user-1",
        type: "PAID_POST",
        postId: null,
      },
      data: { postId: "post-1" },
    });
  });

  it("atomically binds the oldest available credit", async () => {
    mocks.state.articleCredit = { id: "credit-1" };

    await expect(unlockPostWithArticleCredit("user-1", "post-1")).resolves.toEqual({
      success: true,
      reason: "article_credit",
    });
    const creditLookup = mocks.entitlementFindFirst.mock.calls.find(
      ([args]) => args.where?.postId === null
    )?.[0];
    expect(creditLookup).toEqual({
      where: {
        userId: "user-1",
        type: "PAID_POST",
        postId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  });
});

describe("price and legacy compatibility adapters", () => {
  it("returns null when a post has no paid-content row", async () => {
    await expect(getPostPrice("post-1")).resolves.toBeNull();
  });

  it("normalizes Prisma decimal-like prices to CNY numbers", async () => {
    mocks.state.paidContent = { price: { toString: () => "12.50" } };

    await expect(getPostPrice("post-1")).resolves.toEqual({
      price: 12.5,
      currency: "CNY",
    });
  });

  it("maps the real unified decision through the deprecated wrapper", async () => {
    await expect(
      getPostAccess("user-1", "post-1", "公开部分", "付费部分", "PUBLISHED")
    ).resolves.toEqual({
      hasAccess: true,
      reason: "published",
      content: "公开部分",
      articleCreditsAvailable: undefined,
    });
  });
});
