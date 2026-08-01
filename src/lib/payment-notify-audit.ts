import type { PaymentChannel } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

function summarizeRaw(raw?: string): string | null {
  if (!raw) return null;
  const digest = createHash("sha256").update(raw, "utf8").digest("hex");
  return `sha256:${digest};bytes:${Buffer.byteLength(raw, "utf8")}`;
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
        // Failure audits are public-input metadata. The verified callback is
        // retained separately on Payment; keeping raw failed bodies here would
        // retain attacker-controlled PII and enable cheap database-fill abuse.
        rawBody: summarizeRaw(input.rawBody),
      },
    });
  } catch (error) {
    console.error("[PaymentNotifyAudit] write failed:", error);
  }
}
