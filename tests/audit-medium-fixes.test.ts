import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  auth: vi.fn(),
  checkRateLimit: vi.fn(),
  getSiteSettings: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  cardPackageFindFirst: vi.fn(),
  orderCount: vi.fn(),
  orderCreate: vi.fn(),
  transaction: vi.fn(),
  countActiveCardStock: vi.fn(),
  expireStalePendingOrders: vi.fn(),
  reserveCardForOrder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ signIn: mocks.signIn, auth: mocks.auth }));
vi.mock("@/lib/rate-limit-server", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMITS: {
    REGISTER: { limit: 5, windowMs: 1000 },
    ORDER_CREATE: { limit: 10, windowMs: 1000 },
  },
}));
vi.mock("@/lib/site-settings", () => ({ getSiteSettings: mocks.getSiteSettings }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, create: mocks.userCreate },
    cardPackage: { findFirst: mocks.cardPackageFindFirst },
    order: { count: mocks.orderCount },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/card-packages", () => ({ countActiveCardStock: mocks.countActiveCardStock }));
vi.mock("@/lib/order-lifecycle", () => ({
  expireStalePendingOrders: mocks.expireStalePendingOrders,
}));
vi.mock("@/lib/card-delivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/card-delivery")>();
  return { ...actual, reserveCardForOrder: mocks.reserveCardForOrder };
});

import {
  hasJsonContentType,
  isAllowedMutationOrigin,
  requiresSameOriginMutation,
} from "@/lib/csrf-origin";
import {
  CardStockError,
  deliverCardPackageOrder,
  releaseCardReservations,
} from "@/lib/card-delivery";
import { encryptCardSecret } from "@/lib/card-secret-storage";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as createOrderPOST } from "@/app/api/orders/route";

const SITE = "https://site.example.test";

function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`${SITE}${path}`, {
    method: "POST",
    headers: {
      host: "site.example.test",
      origin: SITE,
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(null);
  mocks.getSiteSettings.mockResolvedValue({ openRegistration: true });
  mocks.signIn.mockResolvedValue({});
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("requiresSameOriginMutation", () => {
  it("covers every browser-facing API mutation, not only /api/admin", () => {
    for (const path of [
      "/api/admin/posts",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/callback/credentials",
      "/api/posts/hello/unlock",
      "/api/cards/verify",
      "/api/orders",
      "/api/payment/sync",
    ]) {
      expect(requiresSameOriginMutation(path, "POST"), path).toBe(true);
    }
    expect(requiresSameOriginMutation("/api/admin/users/1", "delete")).toBe(true);
    expect(requiresSameOriginMutation("/api/admin/users/1", "PATCH")).toBe(true);
  });

  it("exempts signed third-party callbacks, cron, reads and non-API paths", () => {
    expect(requiresSameOriginMutation("/api/payment/notify/alipay", "POST")).toBe(false);
    expect(requiresSameOriginMutation("/api/payment/notify/wechat", "POST")).toBe(false);
    expect(requiresSameOriginMutation("/api/cron/expire-orders", "POST")).toBe(false);
    expect(requiresSameOriginMutation("/api/orders", "GET")).toBe(false);
    expect(requiresSameOriginMutation("/api/orders", "HEAD")).toBe(false);
    expect(requiresSameOriginMutation("/payment/alipay-launch", "POST")).toBe(false);
    expect(requiresSameOriginMutation("/apiary", "POST")).toBe(false);
  });

  it("does not let a look-alike prefix skip the check", () => {
    expect(requiresSameOriginMutation("/api/payment/notifyx", "POST")).toBe(true);
    expect(requiresSameOriginMutation("/api/cronjob", "POST")).toBe(true);
  });

  it("rejects a sibling subdomain origin", () => {
    const req = jsonRequest("/api/posts/x/unlock", {}, { origin: "https://ipa.example.test" });
    expect(isAllowedMutationOrigin(req)).toBe(false);
  });
});

describe("hasJsonContentType", () => {
  it("accepts application/json with parameters and rejects simple-request types", () => {
    const withType = (type: string) =>
      new Request(SITE, { method: "POST", headers: { "content-type": type } });
    expect(hasJsonContentType(withType("application/json"))).toBe(true);
    expect(hasJsonContentType(withType("Application/JSON; charset=utf-8"))).toBe(true);
    expect(hasJsonContentType(withType("text/plain"))).toBe(false);
    expect(hasJsonContentType(withType("application/x-www-form-urlencoded"))).toBe(false);
    expect(hasJsonContentType(new Request(SITE, { method: "POST" }))).toBe(false);
  });
});

describe("login CSRF protection", () => {
  const credentials = { email: "victim@example.test", password: "attacker-password" };

  it("rejects a cross-site login before calling signIn", async () => {
    const res = await loginPOST(
      jsonRequest("/api/auth/login", credentials, { origin: "https://evil.example.test" })
    );
    expect(res.status).toBe(403);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("rejects a text/plain form body that smuggles JSON", async () => {
    const res = await loginPOST(
      jsonRequest("/api/auth/login", credentials, { "content-type": "text/plain" })
    );
    expect(res.status).toBe(415);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("still logs in a same-origin JSON request", async () => {
    const res = await loginPOST(jsonRequest("/api/auth/login", credentials));
    expect(res.status).toBe(200);
    expect(mocks.signIn).toHaveBeenCalledOnce();
  });
});

describe("register CSRF protection", () => {
  const payload = { email: "new@example.test", username: "newuser", password: "secret123" };

  it("rejects cross-site and non-JSON registrations without touching the database", async () => {
    const foreign = await registerPOST(
      jsonRequest("/api/auth/register", payload, { origin: "https://evil.example.test" })
    );
    const plain = await registerPOST(
      jsonRequest("/api/auth/register", payload, { "content-type": "text/plain" })
    );
    expect(foreign.status).toBe(403);
    expect(plain.status).toBe(415);
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });
});

describe("card package order reservation", () => {
  const cardOrder = { productType: "CARD_PACKAGE", productId: "package-1" };

  beforeEach(() => {
    mocks.cardPackageFindFirst.mockResolvedValue({ id: "package-1", name: "Pack", price: 10 });
    mocks.orderCount.mockResolvedValue(0);
    mocks.countActiveCardStock.mockResolvedValue(1);
    mocks.expireStalePendingOrders.mockResolvedValue(0);
    mocks.orderCreate.mockImplementation(async ({ data }) => ({ id: "order-1", ...data }));
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ order: { create: mocks.orderCreate } })
    );
  });

  it("reserves a card inside the order transaction", async () => {
    mocks.reserveCardForOrder.mockResolvedValue(undefined);
    const res = await createOrderPOST(jsonRequest("/api/orders", cardOrder));
    expect(res.status).toBe(200);
    expect(mocks.expireStalePendingOrders).toHaveBeenCalledWith({ cardPackageId: "package-1" });
    expect(mocks.reserveCardForOrder).toHaveBeenCalledWith(expect.anything(), {
      id: "order-1",
      productId: "package-1",
    });
  });

  it("answers out-of-stock when the last card was reserved concurrently", async () => {
    mocks.reserveCardForOrder.mockRejectedValue(new CardStockError());
    const res = await createOrderPOST(jsonRequest("/api/orders", cardOrder));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("库存不足");
  });

  it("caps unpaid card orders per user so stock cannot be hoarded", async () => {
    mocks.orderCount.mockResolvedValue(3);
    const res = await createOrderPOST(jsonRequest("/api/orders", cardOrder));
    expect(res.status).toBe(429);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rate-limits order creation", async () => {
    mocks.checkRateLimit.mockResolvedValue(new Response(null, { status: 429 }));
    const res = await createOrderPOST(jsonRequest("/api/orders", cardOrder));
    expect(res.status).toBe(429);
    expect(mocks.cardPackageFindFirst).not.toHaveBeenCalled();
  });

  it("does not reserve cards for non-card products", async () => {
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ order: { create: mocks.orderCreate } })
    );
    const res = await createOrderPOST(jsonRequest("/api/orders", { productType: "VIP_QUARTER" }));
    expect(res.status).toBe(200);
    expect(mocks.reserveCardForOrder).not.toHaveBeenCalled();
  });
});

describe("delivery of reserved cards", () => {
  const order = { id: "order-1", userId: "user-1", productType: "CARD_PACKAGE", productId: "package-1" };
  const card = (overrides: Record<string, unknown> = {}) => ({
    id: "card-reserved",
    cardNo: "NO-RESERVED",
    cardSecretEnc: encryptCardSecret("SECRET-RESERVED"),
    packageId: "package-1",
    status: "ACTIVE",
    expireAt: null,
    orderId: "order-1",
    ...overrides,
  });

  function txWith(reserved: ReturnType<typeof card> | null) {
    const created: Array<{ cardId: string }> = [];
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const tx = {
      orderDelivery: {
        findUnique: async () => null,
        create: async ({ data }: { data: { cardId: string } }) => {
          created.push(data);
          return data;
        },
      },
      cardPackage: { findUnique: async () => ({ id: "package-1" }) },
      card: {
        findUnique: async () => reserved,
        count: async () => 1,
        findFirst: async () => card({ id: "card-pool", cardNo: "NO-POOL", orderId: null }),
        updateMany,
      },
    };
    return { tx, created, updateMany };
  }

  it("delivers the card reserved at checkout without touching the pool", async () => {
    const { tx, created, updateMany } = txWith(card());
    const result = await deliverCardPackageOrder(tx as never, order);
    expect(result).toMatchObject({ cardNo: "NO-RESERVED", cardSecret: "SECRET-RESERVED" });
    expect(created[0].cardId).toBe("card-reserved");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("releases a reservation disabled by an admin and claims a pooled card", async () => {
    const { tx, created, updateMany } = txWith(card({ status: "DISABLED" }));
    const result = await deliverCardPackageOrder(tx as never, order);
    expect(result?.cardNo).toBe("NO-POOL");
    expect(created[0].cardId).toBe("card-pool");
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "card-reserved", orderId: "order-1" },
      data: { orderId: null },
    });
  });

  it("falls back to the pool for legacy orders created before reservations", async () => {
    const { tx, created } = txWith(null);
    await deliverCardPackageOrder(tx as never, order);
    expect(created[0].cardId).toBe("card-pool");
  });

  it("returns undelivered reservations to stock", async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const tx = { card: { updateMany } };
    await expect(releaseCardReservations(tx as never, ["o1", "o2"])).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ["o1", "o2"] }, delivery: { is: null } },
      data: { orderId: null },
    });
    await expect(releaseCardReservations(tx as never, [])).resolves.toBe(0);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
