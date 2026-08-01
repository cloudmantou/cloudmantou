import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MembershipStatus = {
  active: boolean;
  expiresAt: Date | null;
  level: number;
};

export type MembershipDuration =
  | { days: number; months?: never }
  | { months: number; days?: never };

export type GrantMembershipInput = {
  userId: string;
  duration: MembershipDuration;
  level?: number;
  orderId?: string;
  now?: Date;
};

export type SetMembershipInput = {
  userId: string;
  level: number;
  expiresAt: Date | null;
  now?: Date;
};

export type MembershipClient = Pick<
  Prisma.TransactionClient,
  "user" | "entitlement"
>;

export type MembershipWriteClient = MembershipClient &
  Pick<Prisma.TransactionClient, "$queryRaw">;

type MembershipState = {
  user: { vipExpireAt: Date | null; vipLevel: number } | null;
  entitlements: Array<{ expiresAt: Date | null }>;
};

async function readMembershipState(
  client: MembershipClient,
  userId: string,
  now: Date
): Promise<MembershipState> {
  const [user, entitlements] = await Promise.all([
    client.user.findUnique({
      where: { id: userId },
      select: { vipExpireAt: true, vipLevel: true },
    }),
    client.entitlement.findMany({
      where: {
        userId,
        type: "VIP",
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { expiresAt: true },
    }),
  ]);

  return { user, entitlements };
}

/**
 * MySQL REPEATABLE READ may already have a snapshot before entitlement grant runs.
 * Locking reads bypass that stale snapshot and serialize all grants on the user row.
 */
async function readLockedMembershipState(
  client: MembershipWriteClient,
  userId: string,
  now: Date
): Promise<MembershipState> {
  const users = await client.$queryRaw<
    Array<{ vipExpireAt: Date | null; vipLevel: number }>
  >`SELECT vipExpireAt, vipLevel FROM users WHERE id = ${userId} FOR UPDATE`;
  const entitlements = await client.$queryRaw<Array<{ expiresAt: Date | null }>>`
    SELECT expiresAt
    FROM entitlements
    WHERE userId = ${userId}
      AND type = 'VIP'
      AND startsAt <= ${now}
      AND (expiresAt IS NULL OR expiresAt > ${now})
    FOR UPDATE
  `;

  return { user: users[0] ?? null, entitlements };
}

function resolveMembershipStatus(state: MembershipState, now: Date): MembershipStatus {
  if (!state.user) {
    return { active: false, expiresAt: null, level: 0 };
  }

  const activeUserExpiry =
    state.user.vipExpireAt && state.user.vipExpireAt > now
      ? state.user.vipExpireAt
      : null;
  const hasPermanentEntitlement = state.entitlements.some(
    (entitlement) => entitlement.expiresAt === null
  );

  const finiteExpiries = [
    ...(activeUserExpiry ? [activeUserExpiry] : []),
    ...state.entitlements.flatMap((entitlement) =>
      entitlement.expiresAt ? [entitlement.expiresAt] : []
    ),
  ];
  const latestExpiry = finiteExpiries.reduce<Date | null>(
    (latest, candidate) =>
      !latest || candidate > latest ? candidate : latest,
    null
  );
  const active = hasPermanentEntitlement || latestExpiry !== null;

  return {
    active,
    expiresAt: hasPermanentEntitlement ? null : latestExpiry,
    level: active
      ? Math.max(state.user.vipLevel, 1)
      : state.user.vipLevel,
  };
}

/**
 * 统一会员读取入口。Entitlement 是新写入的权威记录，vipExpireAt 作为存量数据
 * 与旧客户端的兼容镜像；读取时取两者中仍有效且期限更强的会员状态。
 */
export async function getMembershipStatus(
  userId: string,
  now = new Date(),
  client: MembershipClient = prisma
): Promise<MembershipStatus> {
  const state = await readMembershipState(client, userId, now);
  return resolveMembershipStatus(state, now);
}

export async function hasActiveMembership(
  userId: string,
  now = new Date(),
  client: MembershipClient = prisma
): Promise<boolean> {
  return (await getMembershipStatus(userId, now, client)).active;
}

function validateDuration(duration: MembershipDuration): number {
  const value = duration.days ?? duration.months;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("会员有效期必须是正整数");
  }
  return value;
}

function extendExpiry(
  base: Date,
  duration: MembershipDuration,
  value: number
): Date {
  const expiresAt = new Date(base);
  if (duration.days !== undefined) {
    expiresAt.setDate(expiresAt.getDate() + value);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + value);
  }
  return expiresAt;
}

/**
 * 统一会员写入入口。调用方应传入当前 Prisma 事务，使权益记录与旧字段镜像原子更新。
 */
export async function grantMembership(
  client: MembershipWriteClient,
  input: GrantMembershipInput
): Promise<MembershipStatus> {
  const durationValue = validateDuration(input.duration);
  const now = input.now ? new Date(input.now) : new Date();

  const state = await readLockedMembershipState(client, input.userId, now);

  if (!state.user) {
    throw new Error("用户不存在");
  }

  const current = resolveMembershipStatus(state, now);
  const requestedLevel = Math.max(1, input.level ?? 1);
  const level = current.active
    ? Math.max(state.user.vipLevel, requestedLevel)
    : requestedLevel;
  const expiresAt =
    current.active && current.expiresAt === null
      ? null
      : extendExpiry(current.expiresAt ?? now, input.duration, durationValue);

  await client.entitlement.create({
    data: {
      userId: input.userId,
      type: "VIP",
      ...(input.orderId ? { orderId: input.orderId } : {}),
      expiresAt,
    },
  });
  await client.user.update({
    where: { id: input.userId },
    data: { vipLevel: level, vipExpireAt: expiresAt },
  });

  return { active: true, expiresAt, level };
}

/**
 * 管理员显式设置会员状态。level=0 表示撤销所有 VIP 权益；启用时写入
 * canonical entitlement，并同步旧字段供仍依赖投影的客户端读取。
 */
export async function setMembership(
  client: MembershipWriteClient,
  input: SetMembershipInput
): Promise<MembershipStatus> {
  if (!Number.isInteger(input.level) || input.level < 0 || input.level > 10) {
    throw new Error("会员等级必须是 0 到 10 的整数");
  }

  const now = input.now ? new Date(input.now) : new Date();
  const state = await readLockedMembershipState(client, input.userId, now);
  if (!state.user) throw new Error("用户不存在");

  if (input.level === 0) {
    await client.entitlement.deleteMany({
      where: { userId: input.userId, type: "VIP" },
    });
    await client.user.update({
      where: { id: input.userId },
      data: { vipLevel: 0, vipExpireAt: null },
    });
    return { active: false, expiresAt: null, level: 0 };
  }

  if (input.expiresAt && input.expiresAt <= now) {
    throw new Error("会员到期时间必须晚于当前时间");
  }

  // Administrator changes are replacements, not additive grants. Leaving an
  // older permanent or longer entitlement in place would make the canonical
  // read model disagree with the newly selected level/expiry.
  await client.entitlement.deleteMany({
    where: { userId: input.userId, type: "VIP" },
  });
  await client.entitlement.create({
    data: {
      userId: input.userId,
      type: "VIP",
      startsAt: now,
      expiresAt: input.expiresAt,
    },
  });
  await client.user.update({
    where: { id: input.userId },
    data: { vipLevel: input.level, vipExpireAt: input.expiresAt },
  });

  return {
    active: true,
    expiresAt: input.expiresAt,
    level: input.level,
  };
}
