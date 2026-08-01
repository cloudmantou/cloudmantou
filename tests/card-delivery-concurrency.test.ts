import { describe, expect, it } from "vitest";
import {
  deliverCardPackageOrder,
  ensureCardDeliveryForPaidOrder,
  retryCardDeliveriesForOrders,
} from "@/lib/card-delivery";
import {
  decryptCardSecret,
  encryptCardSecret,
} from "@/lib/card-secret-storage";

type StoredCard = {
  id: string;
  packageId: string;
  status: string;
  orderId: string | null;
  cardNo: string;
  cardSecretEnc: string;
  createdAt: Date;
};

type StoredDelivery = {
  orderId: string;
  cardId: string;
  cardNo: string;
  cardSecretEnc: string;
  status: string;
};

const PACKAGE_ID = "package-1";

function createOrder(id: string) {
  return {
    id,
    userId: `user-${id}`,
    productType: "CARD_PACKAGE",
    productId: PACKAGE_ID,
  };
}

function createConcurrentStockTx() {
  const cards: StoredCard[] = [
    {
      id: "card-1",
      packageId: PACKAGE_ID,
      status: "ACTIVE",
      orderId: null,
      cardNo: "NO-001",
      cardSecretEnc: encryptCardSecret("SECRET-001"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "card-2",
      packageId: PACKAGE_ID,
      status: "ACTIVE",
      orderId: null,
      cardNo: "NO-002",
      cardSecretEnc: encryptCardSecret("SECRET-002"),
      createdAt: new Date("2026-01-02T00:00:00Z"),
    },
  ];
  const deliveries: StoredDelivery[] = [];
  let initialReads = 0;
  let releaseInitialReads: (() => void) | undefined;
  const initialReadBarrier = new Promise<void>((resolve) => {
    releaseInitialReads = resolve;
  });

  const findAvailableCard = () =>
    cards.find(
      (card) =>
        card.packageId === PACKAGE_ID &&
        card.status === "ACTIVE" &&
        card.orderId === null &&
        Boolean(card.cardSecretEnc)
    );

  const tx = {
    orderDelivery: {
      findUnique: async ({ where }: { where: { orderId: string } }) =>
        deliveries.find((delivery) => delivery.orderId === where.orderId) ?? null,
      create: async ({ data }: { data: StoredDelivery }) => {
        if (
          deliveries.some(
            (delivery) =>
              delivery.orderId === data.orderId || delivery.cardId === data.cardId
          )
        ) {
          throw new Error("unique constraint failed");
        }
        deliveries.push({ ...data });
        return data;
      },
    },
    cardPackage: {
      findUnique: async () => ({ id: PACKAGE_ID }),
    },
    card: {
      count: async () => cards.filter((card) => card.orderId === null).length,
      findFirst: async () => {
        const candidate = findAvailableCard();
        initialReads += 1;
        if (initialReads <= 2) {
          if (initialReads === 2) releaseInitialReads?.();
          await initialReadBarrier;
        }
        return candidate ? { ...candidate } : null;
      },
      // Models the vulnerable implementation: updating by id overwrites a claim.
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { orderId: string };
      }) => {
        const card = cards.find((item) => item.id === where.id);
        if (!card) throw new Error("card not found");
        card.orderId = data.orderId;
        return { ...card };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          packageId: string;
          status: string;
          orderId: null;
          cardSecretEnc: { not: null };
        };
        data: { orderId: string };
      }) => {
        const card = cards.find(
          (item) =>
            item.id === where.id &&
            item.packageId === where.packageId &&
            item.status === where.status &&
            item.orderId === null &&
            Boolean(item.cardSecretEnc)
        );
        if (!card) return { count: 0 };
        card.orderId = data.orderId;
        return { count: 1 };
      },
    },
  };

  return { tx, cards, deliveries };
}

describe("deliverCardPackageOrder concurrency", () => {
  it("continues retrying other persisted pending orders when one delivery fails", async () => {
    const orders = [
      { ...createOrder("order-failed"), status: "PAID" },
      { ...createOrder("order-delivered"), status: "PAID" },
    ];
    const deliver = async (order: { id: string }) => {
      if (order.id === "order-failed") throw new Error("temporary failure");
      return { cardNo: "NO-OK", cardSecret: "SECRET", status: "DELIVERED" };
    };

    await expect(retryCardDeliveriesForOrders(orders, deliver)).resolves.toEqual({
      scanned: 2,
      delivered: 1,
      failed: 1,
    });
  });

  it("ignores orders that do not require card delivery", async () => {
    await expect(
      deliverCardPackageOrder({} as never, {
        ...createOrder("order-vip"),
        productType: "VIP_MONTH",
      })
    ).resolves.toBeNull();
    await expect(
      deliverCardPackageOrder({} as never, {
        ...createOrder("order-missing-product"),
        productId: null,
      })
    ).resolves.toBeNull();
  });

  it("reports missing packages and empty inventory clearly", async () => {
    let emptyStockWhere:
      | { OR?: Array<{ expireAt?: null | { gt: Date } }> }
      | undefined;
    const baseTx = {
      orderDelivery: { findUnique: async () => null },
      cardPackage: { findUnique: async () => null },
      card: { count: async () => 0, findFirst: async () => null },
    };

    await expect(
      deliverCardPackageOrder(baseTx as never, createOrder("order-no-package"))
    ).rejects.toThrow("卡密商品不存在");

    const emptyStockTx = {
      ...baseTx,
      cardPackage: { findUnique: async () => ({ id: PACKAGE_ID }) },
      card: {
        ...baseTx.card,
        count: async ({ where }: { where: typeof emptyStockWhere }) => {
          emptyStockWhere = where;
          return 0;
        },
      },
    };
    await expect(
      deliverCardPackageOrder(emptyStockTx as never, createOrder("order-empty"))
    ).rejects.toThrow("该商品卡密库存不足，请先在后台导入或生成卡密");
    expect(emptyStockWhere?.OR?.[0]).toEqual({ expireAt: null });
    expect(emptyStockWhere?.OR?.[1]?.expireAt).toEqual({ gt: expect.any(Date) });
  });

  it("only backfills paid card-package orders", async () => {
    await expect(
      ensureCardDeliveryForPaidOrder({
        ...createOrder("order-not-card"),
        productType: "VIP_MONTH",
        status: "PAID",
      })
    ).resolves.toBeNull();
    await expect(
      ensureCardDeliveryForPaidOrder({
        ...createOrder("order-not-paid"),
        status: "PENDING",
      })
    ).resolves.toBeNull();
  });

  it("atomically claims distinct cards when paid orders race", async () => {
    const { tx, cards, deliveries } = createConcurrentStockTx();

    const results = await Promise.all([
      deliverCardPackageOrder(tx as never, createOrder("order-a")),
      deliverCardPackageOrder(tx as never, createOrder("order-b")),
    ]);

    expect(results.map((result) => result?.cardNo).sort()).toEqual([
      "NO-001",
      "NO-002",
    ]);
    expect(deliveries).toHaveLength(2);
    expect(new Set(deliveries.map((delivery) => delivery.cardId)).size).toBe(2);
    expect(cards.map((card) => card.orderId).sort()).toEqual([
      "order-a",
      "order-b",
    ]);
  });

  it("returns the existing delivery without consuming more stock", async () => {
    const { tx, cards, deliveries } = createConcurrentStockTx();
    const encryptedSecret = encryptCardSecret("EXISTING-SECRET");
    deliveries.push({
      orderId: "order-existing",
      cardId: "card-existing",
      cardNo: "NO-EXISTING",
      cardSecretEnc: encryptedSecret,
      status: "DELIVERED",
    });

    const result = await deliverCardPackageOrder(
      tx as never,
      createOrder("order-existing")
    );

    expect(result).toEqual({
      cardNo: "NO-EXISTING",
      cardSecret: "EXISTING-SECRET",
      status: "DELIVERED",
    });
    expect(cards.every((card) => card.orderId === null)).toBe(true);
    expect(decryptCardSecret(encryptedSecret)).toBe("EXISTING-SECRET");
  });

  it("excludes a lost candidate before retrying under a stale read snapshot", async () => {
    const cards: StoredCard[] = [
      {
        id: "card-stale",
        packageId: PACKAGE_ID,
        status: "ACTIVE",
        orderId: null,
        cardNo: "NO-STALE",
        cardSecretEnc: encryptCardSecret("SECRET-STALE"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "card-next",
        packageId: PACKAGE_ID,
        status: "ACTIVE",
        orderId: null,
        cardNo: "NO-NEXT",
        cardSecretEnc: encryptCardSecret("SECRET-NEXT"),
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];
    const findFirstCalls: Array<{ where: { id?: { notIn: string[] } } }> = [];
    const deliveries: StoredDelivery[] = [];
    const tx = {
      orderDelivery: {
        findUnique: async () => null,
        create: async ({ data }: { data: StoredDelivery }) => {
          deliveries.push({ ...data });
          return data;
        },
      },
      cardPackage: { findUnique: async () => ({ id: PACKAGE_ID }) },
      card: {
        count: async () => cards.length,
        // Simulates a repeatable-read snapshot: availability stays stale, while
        // an explicit id exclusion can advance to another candidate.
        findFirst: async (args: { where: { id?: { notIn: string[] } } }) => {
          findFirstCalls.push(args);
          const excluded = args.where.id?.notIn ?? [];
          const candidate = cards.find((card) => !excluded.includes(card.id));
          return candidate ? { ...candidate } : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { orderId: string };
        }) => {
          if (where.id === "card-stale") return { count: 0 };
          cards[1].orderId = data.orderId;
          return { count: 1 };
        },
      },
    };

    const result = await deliverCardPackageOrder(
      tx as never,
      createOrder("order-retry")
    );

    expect(result?.cardNo).toBe("NO-NEXT");
    expect(findFirstCalls).toHaveLength(2);
    expect(findFirstCalls[1].where.id?.notIn).toContain("card-stale");
    expect(deliveries[0].cardId).toBe("card-next");
  });

  it("fails explicitly after bounded claim conflicts", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      id: `card-conflict-${index}`,
      cardNo: `NO-CONFLICT-${index}`,
      cardSecretEnc: encryptCardSecret(`SECRET-CONFLICT-${index}`),
    }));
    let claimAttempts = 0;
    const tx = {
      orderDelivery: {
        findUnique: async () => null,
        create: async () => {
          throw new Error("delivery must not be created");
        },
      },
      cardPackage: { findUnique: async () => ({ id: PACKAGE_ID }) },
      card: {
        count: async () => candidates.length,
        findFirst: async (args: { where: { id?: { notIn: string[] } } }) => {
          const excluded = args.where.id?.notIn ?? [];
          return candidates.find((card) => !excluded.includes(card.id)) ?? null;
        },
        updateMany: async () => {
          claimAttempts += 1;
          return { count: 0 };
        },
      },
    };

    await expect(
      deliverCardPackageOrder(tx as never, createOrder("order-conflict"))
    ).rejects.toThrow("卡密库存领取冲突，请稍后重试");
    expect(claimAttempts).toBe(5);
  });

  it("can advance past five lost claims while startup inventory remains", async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => ({
      id: `card-race-${index}`,
      cardNo: `NO-RACE-${index}`,
      cardSecretEnc: encryptCardSecret(`SECRET-RACE-${index}`),
    }));
    let claimAttempts = 0;
    const tx = {
      orderDelivery: {
        findUnique: async () => null,
        create: async ({ data }: { data: StoredDelivery }) => data,
      },
      cardPackage: { findUnique: async () => ({ id: PACKAGE_ID }) },
      card: {
        count: async () => candidates.length,
        findFirst: async (args: { where: { id?: { notIn: string[] } } }) => {
          const excluded = args.where.id?.notIn ?? [];
          return candidates.find((card) => !excluded.includes(card.id)) ?? null;
        },
        updateMany: async ({ where }: { where: { id: string } }) => {
          claimAttempts += 1;
          return { count: where.id === "card-race-5" ? 1 : 0 };
        },
      },
    };

    const result = await deliverCardPackageOrder(
      tx as never,
      createOrder("order-sixth-candidate")
    );

    expect(result?.cardNo).toBe("NO-RACE-5");
    expect(claimAttempts).toBe(6);
  });
});
