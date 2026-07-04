import type { PaymentChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_RAW_BODY = 65_536;

function truncateRaw(raw?: string): string | null {
  if (!raw) return null;
  if (raw.length <= MAX_RAW_BODY) return raw;
  return `${raw.slice(0, MAX_RAW_BODY)}...[truncated]`;
}

export type PaymentNotifyAuditInput = {
  channel: PaymentChannel;
  orderNo?: string | null;
  status: string;
  reason?: string;
  rawBody?: string;
};

/** 支付回调失败/异常落库，便于公钥缺失、验签失败等场景排错 */
export async function recordPaymentNotifyAudit(
  input: PaymentNotifyAuditInput
): Promise<void> {
  try {
    await prisma.paymentNotifyAudit.create({
      data: {
        channel: input.channel,
        orderNo: input.orderNo?.slice(0, 64) ?? null,
        status: input.status.slice(0, 64),
        reason: input.reason?.slice(0, 500) ?? null,
        rawBody: truncateRaw(input.rawBody),
      },
    });
  } catch (error) {
    console.error("[PaymentNotifyAudit] write failed:", error);
  }
}