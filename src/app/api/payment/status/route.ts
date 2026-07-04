import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { ensureCardDeliveryForPaidOrder } from "@/lib/card-delivery";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const orderNo = req.nextUrl.searchParams.get("orderNo");
    if (!orderNo) {
      return fail("缺少订单号", 40000, 400);
    }

    let order = await prisma.order.findUnique({
      where: { orderNo },
      include: { payment: true, delivery: true },
    });

    if (!order || order.userId !== session.user.id) {
      return fail("订单不存在", 40400, 404);
    }

    // 支付轮询路径：仅对当前单笔已支付卡密订单做幂等补发，不在列表 GET 上批量 backfill
    if (
      order.status === "PAID" &&
      order.productType === "CARD_PACKAGE" &&
      !order.delivery
    ) {
      try {
        await ensureCardDeliveryForPaidOrder(order);
        order = await prisma.order.findUnique({
          where: { orderNo },
          include: { payment: true, delivery: true },
        });
      } catch (deliveryError) {
        console.error("[Payment Status] card delivery backfill failed:", orderNo, deliveryError);
      }
    }

    if (!order) {
      return fail("订单不存在", 40400, 404);
    }

    return ok({
      orderNo: order.orderNo,
      status: order.status,
      title: order.title,
      amount: Number(order.amount),
      paidAt: order.paidAt?.toISOString() || null,
      payment: order.payment
        ? {
            channel: order.payment.channel,
            status: order.payment.status,
          }
        : null,
      deliveryPending:
        order.status === "PAID" &&
        order.productType === "CARD_PACKAGE" &&
        !order.delivery,
    });
  } catch (error) {
    console.error("[Payment Status Error]", error);
    return fail("查询支付状态失败", 50000, 500);
  }
}