import { describe, expect, it, vi } from "vitest";
import {
  getMembershipStatus,
  grantMembership,
  setMembership,
} from "@/lib/membership-service";

type MembershipFixture = {
  user: { vipExpireAt: Date | null; vipLevel: number } | null;
  entitlements?: Array<{ expiresAt: Date | null }>;
  lockedUser?: { vipExpireAt: Date | null; vipLevel: number } | null;
  lockedEntitlements?: Array<{ expiresAt: Date | null }>;
};

function createMembershipClient(fixture: MembershipFixture) {
  const userUpdates: unknown[] = [];
  const entitlementsCreated: unknown[] = [];
  const entitlementDeletes: unknown[] = [];

  const client = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      const sql = Array.from(query).join(" ");
      if (sql.includes("FROM users")) {
        const lockedUser = fixture.lockedUser === undefined
          ? fixture.user
          : fixture.lockedUser;
        return lockedUser ? [{ ...lockedUser }] : [];
      }
      if (sql.includes("FROM entitlements")) {
        return fixture.lockedEntitlements ?? fixture.entitlements ?? [];
      }
      return [];
    }),
    user: {
      findUnique: vi.fn(async () => fixture.user),
      update: vi.fn(async (args: unknown) => {
        userUpdates.push(args);
        return {};
      }),
    },
    entitlement: {
      findMany: vi.fn(async () => fixture.entitlements ?? []),
      create: vi.fn(async (args: unknown) => {
        entitlementsCreated.push(args);
        return {};
      }),
      deleteMany: vi.fn(async (args: unknown) => {
        entitlementDeletes.push(args);
        return { count: fixture.entitlements?.length ?? 0 };
      }),
    },
  };

  return { client, userUpdates, entitlementsCreated, entitlementDeletes };
}

describe("getMembershipStatus", () => {
  const now = new Date("2026-07-19T00:00:00.000Z");

  it("keeps legacy vipExpireAt memberships active when no entitlement row exists", async () => {
    const legacyExpiry = new Date("2026-08-19T00:00:00.000Z");
    const { client } = createMembershipClient({
      user: { vipExpireAt: legacyExpiry, vipLevel: 1 },
    });

    const status = await getMembershipStatus("user-1", now, client as never);

    expect(status).toEqual({
      active: true,
      expiresAt: legacyExpiry,
      level: 1,
    });
    expect(client.entitlement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ startsAt: { lte: now } }),
      })
    );
  });

  it("uses an active entitlement when the legacy user mirror is stale", async () => {
    const entitlementExpiry = new Date("2026-09-19T00:00:00.000Z");
    const { client } = createMembershipClient({
      user: { vipExpireAt: new Date("2026-06-01T00:00:00.000Z"), vipLevel: 0 },
      entitlements: [{ expiresAt: entitlementExpiry }],
    });

    const status = await getMembershipStatus("user-1", now, client as never);

    expect(status).toEqual({
      active: true,
      expiresAt: entitlementExpiry,
      level: 1,
    });
  });

  it("treats a non-expiring VIP entitlement as active", async () => {
    const { client } = createMembershipClient({
      user: { vipExpireAt: null, vipLevel: 0 },
      entitlements: [{ expiresAt: null }],
    });

    await expect(
      getMembershipStatus("user-1", now, client as never)
    ).resolves.toEqual({ active: true, expiresAt: null, level: 1 });
  });

  it("does not authorize orphaned entitlement data when the user is missing", async () => {
    const { client } = createMembershipClient({
      user: null,
      entitlements: [{ expiresAt: null }],
    });

    await expect(
      getMembershipStatus("missing-user", now, client as never)
    ).resolves.toEqual({ active: false, expiresAt: null, level: 0 });
  });
});

describe("grantMembership", () => {
  const now = new Date("2026-07-19T00:00:00.000Z");

  it("extends from the latest active source and writes both canonical entitlement and legacy mirror", async () => {
    const entitlementExpiry = new Date("2026-09-19T00:00:00.000Z");
    const { client, userUpdates, entitlementsCreated } = createMembershipClient({
      user: { vipExpireAt: new Date("2026-08-19T00:00:00.000Z"), vipLevel: 1 },
      entitlements: [{ expiresAt: entitlementExpiry }],
    });

    const result = await grantMembership(client as never, {
      userId: "user-1",
      duration: { months: 1 },
      level: 2,
      orderId: "order-1",
      now,
    });

    expect(result.expiresAt).toEqual(new Date("2026-10-19T00:00:00.000Z"));
    expect(client.$queryRaw).toHaveBeenCalledTimes(2);
    expect(client.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      client.$queryRaw.mock.invocationCallOrder[1]
    );
    expect(entitlementsCreated).toEqual([
      {
        data: {
          userId: "user-1",
          type: "VIP",
          orderId: "order-1",
          expiresAt: new Date("2026-10-19T00:00:00.000Z"),
        },
      },
    ]);
    expect(userUpdates).toEqual([
      {
        where: { id: "user-1" },
        data: {
          vipLevel: 2,
          vipExpireAt: new Date("2026-10-19T00:00:00.000Z"),
        },
      },
    ]);
  });

  it("supports card grants measured in days", async () => {
    const { client } = createMembershipClient({
      user: { vipExpireAt: null, vipLevel: 0 },
    });

    const result = await grantMembership(client as never, {
      userId: "user-1",
      duration: { days: 30 },
      level: 1,
      now,
    });

    expect(result.expiresAt).toEqual(new Date("2026-08-18T00:00:00.000Z"));
    expect(result.level).toBe(1);
  });

  it("does not carry an expired higher legacy level into a new lower-tier grant", async () => {
    const { client } = createMembershipClient({
      user: { vipExpireAt: new Date("2026-06-19T00:00:00.000Z"), vipLevel: 2 },
      lockedUser: { vipExpireAt: new Date("2026-06-19T00:00:00.000Z"), vipLevel: 2 },
    });

    const result = await grantMembership(client as never, {
      userId: "user-1",
      duration: { months: 1 },
      level: 1,
      now,
    });

    expect(result.level).toBe(1);
  });

  it("extends from the current locked row instead of an earlier repeatable-read snapshot", async () => {
    const { client } = createMembershipClient({
      user: {
        vipExpireAt: new Date("2026-08-19T00:00:00.000Z"),
        vipLevel: 1,
      },
      lockedUser: {
        vipExpireAt: new Date("2026-10-19T00:00:00.000Z"),
        vipLevel: 1,
      },
    });

    const result = await grantMembership(client as never, {
      userId: "user-1",
      duration: { months: 1 },
      now,
    });

    expect(result.expiresAt).toEqual(new Date("2026-11-19T00:00:00.000Z"));
    expect(client.user.findUnique).not.toHaveBeenCalled();
    expect(client.entitlement.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid durations before writing", async () => {
    const { client, userUpdates, entitlementsCreated } = createMembershipClient({
      user: { vipExpireAt: null, vipLevel: 0 },
    });

    await expect(
      grantMembership(client as never, {
        userId: "user-1",
        duration: { days: 0 },
        level: 1,
        now,
      })
    ).rejects.toThrow("会员有效期必须是正整数");
    expect(userUpdates).toHaveLength(0);
    expect(entitlementsCreated).toHaveLength(0);
  });
});

describe("setMembership", () => {
  const now = new Date("2026-07-19T00:00:00.000Z");

  it("creates a canonical entitlement when an administrator enables VIP", async () => {
    const { client, entitlementDeletes, entitlementsCreated, userUpdates } = createMembershipClient({
      user: { vipExpireAt: null, vipLevel: 0 },
      entitlements: [{ expiresAt: null }],
    });
    const expiresAt = new Date("2026-08-18T00:00:00.000Z");

    await setMembership(client as never, {
      userId: "user-1",
      level: 2,
      expiresAt,
      now,
    });

    expect(entitlementDeletes).toContainEqual({
      where: { userId: "user-1", type: "VIP" },
    });
    expect(entitlementsCreated).toContainEqual({
      data: {
        userId: "user-1",
        type: "VIP",
        startsAt: now,
        expiresAt,
      },
    });
    expect(userUpdates).toContainEqual({
      where: { id: "user-1" },
      data: { vipLevel: 2, vipExpireAt: expiresAt },
    });
  });

  it("revokes canonical entitlements and the legacy mirror when VIP is reset", async () => {
    const { client, entitlementDeletes, userUpdates } = createMembershipClient({
      user: { vipExpireAt: new Date("2026-08-18T00:00:00.000Z"), vipLevel: 1 },
      entitlements: [{ expiresAt: new Date("2026-08-18T00:00:00.000Z") }],
    });

    await setMembership(client as never, {
      userId: "user-1",
      level: 0,
      expiresAt: null,
      now,
    });

    expect(entitlementDeletes).toContainEqual({
      where: { userId: "user-1", type: "VIP" },
    });
    expect(userUpdates).toContainEqual({
      where: { id: "user-1" },
      data: { vipLevel: 0, vipExpireAt: null },
    });
  });
});
