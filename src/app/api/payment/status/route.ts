import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

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

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { payment: true },
    });

    if (!order || order.userId !== session.user.id) {
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
    });
  } catch (error) {
    console.error("[Payment Status Error]", error);
    return fail("查询支付状态失败", 50000, 500);
  }
}