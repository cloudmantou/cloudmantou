import { describe, expect, it, beforeAll } from "vitest";

/**
 * 安全审计修复验证测试 — 权益发放逻辑 (payment.ts grantEntitlement)
 *
 * 核心验证点：
 * 1. VIP_MONTH / VIP_QUARTER / VIP_YEAR 分支都写入 vipExpireAt
 * 2. PAID_POST 分支创建的 entitlement 含 expiresAt（1 年有效期）
 * 3. VIP 续费逻辑：当前 VIP 未过期时从现有到期时间续期
 */

// payment.ts 导入 prisma（惰性连接，不会在导入时报错）。
// grantEntitlement 接受 tx 参数，不直接使用模块级 prisma，便于 mock。
let grantEntitlement: any;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "mysql://fake:fake@localhost:3306/fake";
  }
  const mod = await import("@/lib/payment");
  grantEntitlement = mod.grantEntitlement;
});

/**
 * 创建 mock Prisma 事务对象，记录所有调用以便断言
 */
function createMockTx(user?: { id: string; vipExpireAt: Date | null; vipLevel: number }) {
  const entitlementsCreated: any[] = [];
  const userUpdates: any[] = [];
  const findUniqueCalls: any[] = [];

  const tx: any = {
    user: {
      findUnique: async (args: any) => {
        findUniqueCalls.push(args);
        return user ? { ...user } : null;
      },
      update: async (args: any) => {
        userUpdates.push(args);
        return {};
      },
    },
    entitlement: {
      create: async (args: any) => {
        entitlementsCreated.push(args.data);
        return args.data;
      },
    },
  };

  return { tx, entitlementsCreated, userUpdates, findUniqueCalls };
}

const ORDER_BASE = {
  id: "order-001",
  userId: "user-001",
  productId: null,
};

describe("grantEntitlement — VIP 分支写入 vipExpireAt", () => {
  it("VIP_MONTH：创建 VIP 权益 + 更新 user.vipExpireAt", async () => {
    const now = new Date();
    const { tx, entitlementsCreated, userUpdates } = createMockTx({
      id: "user-001",
      vipExpireAt: null,
      vipLevel: 0,
    });

    await grantEntitlement(tx, { ...ORDER_BASE, productType: "VIP_MONTH" });

    // 创建了 VIP 类型权益
    expect(entitlementsCreated).toHaveLength(1);
    expect(entitlementsCreated[0].type).toBe("VIP");
    expect(entitlementsCreated[0].userId).toBe("user-001");
    expect(entitlementsCreated[0].expiresAt).toBeInstanceOf(Date);

    // 更新了用户 VIP 等级和到期时间
    expect(userUpdates).toHaveLength(1);
    expect(userUpdates[0].where.id).toBe("user-001");
    expect(userUpdates[0].data.vipLevel).toEqual({ set: 1 });
    expect(userUpdates[0].data.vipExpireAt).toBeInstanceOf(Date);
  });

  it("VIP_QUARTER：写入 vipExpireAt（3 个月续期）", async () => {
    const { tx, userUpdates, entitlementsCreated } = createMockTx({
      id: "user-001",
      vipExpireAt: null,
      vipLevel: 0,
    });

    await grantEntitlement(tx, { ...ORDER_BASE, productType: "VIP_QUARTER" });

    expect(entitlementsCreated[0].type).toBe("VIP");
    expect(userUpdates[0].data.vipLevel).toEqual({ set: 1 });
    expect(userUpdates[0].data.vipExpireAt).toBeInstanceOf(Date);
  });

  it("VIP_YEAR：写入 vipExpireAt 且 vipLevel=2", async () => {
    const { tx, userUpdates } = createMockTx({
      id: "user-001",
      vipExpireAt: null,
      vipLevel: 0,
    });

    await grantEntitlement(tx, { ...ORDER_BASE, productType: "VIP_YEAR" });

    expect(userUpdates[0].data.vipLevel).toEqual({ set: 2 });
    expect(userUpdates[0].data.vipExpireAt).toBeInstanceOf(Date);
  });

  it("VIP 续费：当前未过期时从现有到期时间续期（而非从 now）", async () => {
    // 模拟当前 VIP 还有 6 个月到期
    const futureExpiry = new Date();
    futureExpiry.setMonth(futureExpiry.getMonth() + 6);

    const { tx, userUpdates } = createMockTx({
      id: "user-001",
      vipExpireAt: futureExpiry,
      vipLevel: 1,
    });

    await grantEntitlement(tx, { ...ORDER_BASE, productType: "VIP_MONTH" });

    const grantedExpiry = userUpdates[0].data.vipExpireAt as Date;

    // 续期 1 个月，应从现有到期时间（6 个月后）开始，即 7 个月后
    const now = new Date();
    const sevenMonthsLater = new Date(now);
    sevenMonthsLater.setMonth(sevenMonthsLater.getMonth() + 7);

    // 容差 1 秒（测试执行时间）
    expect(Math.abs(grantedExpiry.getTime() - sevenMonthsLater.getTime())).toBeLessThan(1000);

    // 不应等于从 now 起算 1 个月
    const oneMonthFromNow = new Date(now);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    expect(grantedExpiry.getTime()).toBeGreaterThan(oneMonthFromNow.getTime() + 60_000);
  });
});

describe("grantEntitlement — PAID_POST 分支创建含 expiresAt 的权益", () => {
  it("PAID_POST：创建权益记录含 expiresAt（1 年有效期）", async () => {
    const { tx, entitlementsCreated, userUpdates } = createMockTx();

    const beforeGrant = Date.now();
    await grantEntitlement(tx, {
      ...ORDER_BASE,
      productType: "PAID_POST",
      productId: "post-abc-123",
    });

    // 创建了 PAID_POST 权益
    expect(entitlementsCreated).toHaveLength(1);
    const ent = entitlementsCreated[0];
    expect(ent.type).toBe("PAID_POST");
    expect(ent.userId).toBe("user-001");
    expect(ent.postId).toBe("post-abc-123");
    expect(ent.expiresAt).toBeInstanceOf(Date);

    // expiresAt 应为约 1 年后
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const expiresInMs = ent.expiresAt.getTime() - beforeGrant;
    // 容差 5 秒
    expect(expiresInMs).toBeGreaterThan(oneYearMs - 5000);
    expect(expiresInMs).toBeLessThan(oneYearMs + 5000);

    // 不应更新用户 VIP 字段
    expect(userUpdates).toHaveLength(0);
  });

  it("PAID_POST：productId 为 null 时不创建权益", async () => {
    const { tx, entitlementsCreated } = createMockTx();

    await grantEntitlement(tx, {
      ...ORDER_BASE,
      productType: "PAID_POST",
      productId: null,
    });

    expect(entitlementsCreated).toHaveLength(0);
  });
});

describe("grantEntitlement — CARD_PACKAGE 分支无操作", () => {
  it("CARD_PACKAGE：不创建权益也不更新用户", async () => {
    const { tx, entitlementsCreated, userUpdates } = createMockTx();

    await grantEntitlement(tx, { ...ORDER_BASE, productType: "CARD_PACKAGE" });

    expect(entitlementsCreated).toHaveLength(0);
    expect(userUpdates).toHaveLength(0);
  });
});
