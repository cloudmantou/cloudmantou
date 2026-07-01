import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

/**
 * Payment callback endpoint.
 * Supports Alipay and WeChat pay notification formats.
 * This is a scaffold — actual signature verification should be added
 * when integrating with real payment providers.
 *
 * Expected POST body:
 * {
 *   channel: "ALIPAY" | "WECHAT",
 *   orderNo: string,
 *   tradeNo: string,
 *   amount: number,
 *   status: "SUCCESS" | "FAILED",
 *   rawCallback: string (raw callback data for audit)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel, orderNo, tradeNo, amount, status, rawCallback } = body;

    if (!orderNo || !channel || !tradeNo) {
      return fail("参数不完整", 42200, 422);
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { payment: true },
    });

    if (!order) {
      return fail("订单不存在", 40400, 404);
    }

    // Idempotent: if already paid, return success
    if (order.status === "PAID") {
      return ok({ message: "订单已处理" });
    }

    // Only PENDING orders can be paid
    if (order.status !== "PENDING") {
      return fail(`订单状态异常: ${order.status}`, 40000, 400);
    }

    // Verify amount matches
    if (Math.abs(Number(order.amount) - amount) > 0.01) {
      return fail("金额不匹配", 40000, 400);
    }

    // Process payment in transaction
    await prisma.$transaction(async (tx) => {
      // Create or update payment record
      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: {
            tradeNo,
            status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
            rawCallback: rawCallback ? JSON.stringify(rawCallback) : null,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            channel: channel,
            amount: order.amount,
            tradeNo,
            status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
            rawCallback: rawCallback ? JSON.stringify(rawCallback) : null,
          },
        });
      }

      if (status === "SUCCESS") {
        // Update order status
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", paidAt: new Date() },
        });

        // Grant entitlement based on product type
        const expiresAt = new Date();
        switch (order.productType) {
          case "VIP_MONTH":
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            await tx.entitlement.create({
              data: {
                userId: order.userId,
                type: "VIP",
                orderId: order.id,
                expiresAt,
              },
            });
            break;
          case "VIP_QUARTER":
            expiresAt.setMonth(expiresAt.getMonth() + 3);
            await tx.entitlement.create({
              data: {
                userId: order.userId,
                type: "VIP",
                orderId: order.id,
                expiresAt,
              },
            });
            break;
          case "VIP_YEAR":
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            await tx.entitlement.create({
              data: {
                userId: order.userId,
                type: "VIP",
                orderId: order.id,
                expiresAt,
              },
            });
            break;
          case "PAID_POST":
            if (order.productId) {
              await tx.entitlement.create({
                data: {
                  userId: order.userId,
                  postId: order.productId,
                  type: "PAID_POST",
                  orderId: order.id,
                },
              });
            }
            break;
          case "CARD_PACKAGE":
            // Card package delivery is handled separately
            break;
        }
      }
    });

    return ok({ message: "处理成功" });
  } catch (error) {
    console.error("[Payment Notify Error]", error);
    return fail("处理失败", 50000, 500);
  }
}
