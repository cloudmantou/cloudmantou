import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  expireStalePendingOrders: vi.fn(),
  retryPendingCardDeliveries: vi.fn(),
}));

vi.mock("@/lib/order-lifecycle", () => ({
  expireStalePendingOrders: mocks.expireStalePendingOrders,
}));
vi.mock("@/lib/card-delivery", () => ({
  retryPendingCardDeliveries: mocks.retryPendingCardDeliveries,
}));

import { GET } from "@/app/api/cron/expire-orders/route";

const originalCronSecret = process.env.CRON_SECRET;

describe("order maintenance cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    mocks.expireStalePendingOrders.mockResolvedValue(3);
    mocks.retryPendingCardDeliveries.mockResolvedValue({
      scanned: 2,
      delivered: 1,
      failed: 1,
    });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("expires stale orders and retries persisted card deliveries", async () => {
    const response = await GET(new NextRequest(
      "https://example.com/api/cron/expire-orders",
      { headers: { authorization: "Bearer cron-test-secret" } }
    ));

    expect(response.status).toBe(200);
    expect(mocks.expireStalePendingOrders).toHaveBeenCalledOnce();
    expect(mocks.retryPendingCardDeliveries).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      data: {
        expired: 3,
        cardDeliveries: { scanned: 2, delivered: 1, failed: 1 },
      },
    });
  });

  it("rejects query-string secrets so credentials do not enter access logs", async () => {
    const response = await GET(new NextRequest(
      "https://example.com/api/cron/expire-orders?secret=cron-test-secret"
    ));

    expect(response.status).toBe(401);
    expect(mocks.expireStalePendingOrders).not.toHaveBeenCalled();
    expect(mocks.retryPendingCardDeliveries).not.toHaveBeenCalled();
  });
});
