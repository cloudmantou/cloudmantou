import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { grantEntitlement } from "@/lib/payment";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";

const schema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const config = await getPaymentRuntimeConfig();
    if (!config.testMode) {
      return fail("测试支付未开启", 40300, 403);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { payment: true },
    });

    if (!order || order.userId !== session.user.id) {
      return fail("订单不存在", 40400, 404);
    }

    if (order.status === "PAID") {
      return ok({ paid: true, orderNo: order.orderNo });
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (updated.count === 0) return;

      const paymentData = {
        orderId: order.id,
        channel: (order.payment?.channel || "ALIPAY") as "ALIPAY" | "WECHAT",
        amount: order.amount,
        tradeNo: `TEST${Date.now()}`,
        status: "SUCCESS" as const,
        rawCallback: JSON.stringify({ test: true }),
      };

      if (order.payment) {
        await tx.payment.update({ where: { orderId: order.id }, data: paymentData });
      } else {
        await tx.payment.create({ data: paymentData });
      }

      await grantEntitlement(tx, order);
    });

    return ok({ paid: true, orderNo: order.orderNo });
  } catch (error) {
    console.error("[Test Pay Error]", error);
    return fail("模拟支付失败", 50000, 500);
  }
}