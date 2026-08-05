import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ClaimPaymentChannelInput = {
  orderId: string;
  channel: "ALIPAY" | "WECHAT";
  amount: Prisma.Decimal | string | number;
};

/**
 * Atomically binds an order to its first payment channel.
 * The unique orderId constraint is the concurrency boundary; the update path
 * deliberately preserves the existing channel.
 */
export async function claimPaymentChannel(input: ClaimPaymentChannelInput): Promise<boolean> {
  const payment = await prisma.payment.upsert({
    where: { orderId: input.orderId },
    create: {
      orderId: input.orderId,
      channel: input.channel,
      amount: input.amount,
      status: "WAITING",
    },
    update: {
      amount: input.amount,
    },
    select: { channel: true },
  });

  return payment.channel === input.channel;
}
