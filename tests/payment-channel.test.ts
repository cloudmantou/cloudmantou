import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { payment: { upsert: mocks.upsert } },
}));

import { claimPaymentChannel } from "@/lib/payment-channel";

describe("payment channel claim", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims the first channel without allowing a concurrent update to overwrite it", async () => {
    mocks.upsert.mockResolvedValue({ channel: "ALIPAY" });

    await expect(claimPaymentChannel({
      orderId: "order-1",
      channel: "ALIPAY",
      amount: "1.00",
    })).resolves.toBe(true);

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderId: "order-1" },
      create: expect.objectContaining({ channel: "ALIPAY" }),
    }));
    const update = mocks.upsert.mock.calls[0]?.[0]?.update;
    expect(update).not.toHaveProperty("channel");
    expect(update).not.toHaveProperty("status");
  });

  it("rejects the caller when another channel won the unique order claim", async () => {
    mocks.upsert.mockResolvedValue({ channel: "WECHAT" });

    await expect(claimPaymentChannel({
      orderId: "order-1",
      channel: "ALIPAY",
      amount: "1.00",
    })).resolves.toBe(false);
  });
});
