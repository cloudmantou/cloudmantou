import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  expireStalePendingOrders: vi.fn(),
  retryPendingCardDeliveries: vi.fn(),
  expireLicenseBindings: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/order-lifecycle", () => ({
  expireStalePendingOrders: mocks.expireStalePendingOrders,
}));
vi.mock("@/lib/card-delivery", () => ({
  retryPendingCardDeliveries: mocks.retryPendingCardDeliveries,
}));

vi.mock("@/lib/app-licenses", () => ({
  expireLicenseBindings: mocks.expireLicenseBindings,
}));
vi.mock("@/lib/admin-audit-log", () => ({
  recordAdminAudit: mocks.recordAdminAudit,
}));

import { GET } from "@/app/api/cron/expire-orders/route";

const originalCronSecret = process.env.CRON_SECRET;
const originalLicenseDb = process.env.LEGACY_CARD_DATABASE_URL;

function cronRequest() {
  return new NextRequest("https://example.com/api/cron/expire-orders", {
    headers: { authorization: "Bearer cron-test-secret" },
  });
}

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
    process.env.LEGACY_CARD_DATABASE_URL = "mysql://legacy";
    mocks.expireLicenseBindings.mockResolvedValue({ ttlDays: 30, removed: 0, batches: 0, more: false });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalLicenseDb === undefined) delete process.env.LEGACY_CARD_DATABASE_URL;
    else process.env.LEGACY_CARD_DATABASE_URL = originalLicenseDb;
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
    expect(mocks.expireLicenseBindings).not.toHaveBeenCalled();
  });

  it("expires month-old device bindings and audits only counts", async () => {
    mocks.expireLicenseBindings.mockResolvedValue({ ttlDays: 30, removed: 12, batches: 1, more: false });
    const response = await GET(cronRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { licenseBindings: { removed: 12, ttlDays: 30 } } });
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "system:cron",
      action: "app-licenses.binding.expire",
      detail: "removed=12 ttlDays=30 batches=1 more=false",
    }));
  });

  it("does not audit when no binding expired", async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(200);
    expect(mocks.recordAdminAudit).not.toHaveBeenCalled();
  });

  it("skips binding expiry when the legacy database is not configured", async () => {
    delete process.env.LEGACY_CARD_DATABASE_URL;
    const response = await GET(cronRequest());
    expect(mocks.expireLicenseBindings).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ data: { expired: 3, licenseBindings: { skipped: expect.any(String) } } });
  });

  it("keeps order maintenance working when the legacy database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.expireLicenseBindings.mockRejectedValue(new Error("mysql://user:secret@host down"));
    const response = await GET(cronRequest());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("secret@host");
    expect(JSON.parse(text)).toMatchObject({ data: { expired: 3, licenseBindings: { error: expect.any(String) } } });
  });
});
