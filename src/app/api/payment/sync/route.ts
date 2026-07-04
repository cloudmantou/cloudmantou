import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { queryAlipayTrade } from "@/lib/payment-providers";
import { expireStalePendingOrders, ensureOrderPayable } from "@/lib/order-lifecycle";
import { finalizeAlipayOrder, verifyAlipaySign, verifyAmount } from "@/lib/payment";

export const dynamic = "force-dynamic";

function pickAlipayReturnParams(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "orderNo") continue;
    params[key] = value;
  }
  return params;
}

async function syncAlipayOrder(orderNo: string, returnParams: Record<string, string>) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { payment: true },
  });

  if (!order) {
    return fail("订单不存在", 40400, 404);
  }

  if (order.status === "PAID") {
    return ok({ status: "PAID", synced: true, source: "cache" });
  }

  await expireStalePendingOrders({ userId: order.userId });

  const payable = await ensureOrderPayable(order);
  if (payable.expired) {
    return ok({ status: "EXPIRED", synced: true, source: "expiry" });
  }

  if (order.status !== "PENDING") {
    return ok({ status: order.status, synced: false });
  }

  const config = await getPaymentRuntimeConfig();
  const alipayConfig = config.alipay;
  if (!alipayConfig?.enabled) {
    return fail("支付宝未配置", 40000, 400);
  }

  // 同步回跳参数（沙箱/生产均可能带上 sign + trade_no）
  if (returnParams.sign && returnParams.out_trade_no === orderNo && returnParams.trade_no) {
    if (verifyAlipaySign(returnParams, alipayConfig.publicKey)) {
      if (
        returnParams.total_amount &&
        !verifyAmount(order.amount, returnParams.total_amount)
      ) {
        return fail("支付金额与订单不一致", 40000, 400);
      }

      await finalizeAlipayOrder({
        order,
        tradeNo: returnParams.trade_no,
        rawCallback: new URLSearchParams(returnParams).toString(),
      });

      return ok({ status: "PAID", synced: true, source: "return" });
    }
  }

  const query = await queryAlipayTrade({
    config: alipayConfig,
    orderNo,
  });

  if (!query.paid || !query.tradeNo) {
    return ok({
      status: "PENDING",
      synced: false,
      tradeStatus: query.tradeStatus,
      message: query.message,
    });
  }

  if (query.totalAmount && !verifyAmount(order.amount, query.totalAmount)) {
    return fail("支付金额与订单不一致", 40000, 400);
  }

  await finalizeAlipayOrder({
    order,
    tradeNo: query.tradeNo,
    rawCallback: query.raw,
  });

  return ok({ status: "PAID", synced: true, source: "query" });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orderNo = String(body.orderNo || "").trim();
    if (!orderNo) {
      return fail("缺少订单号", 40000, 400);
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order || order.userId !== session.user.id) {
      return fail("订单不存在", 40400, 404);
    }

    const returnParams =
      body.returnParams && typeof body.returnParams === "object"
        ? (body.returnParams as Record<string, string>)
        : {};

    return await syncAlipayOrder(orderNo, returnParams);
  } catch (error) {
    console.error("[Payment Sync Error]", error);
    return fail("同步支付状态失败", 50000, 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const orderNo = req.nextUrl.searchParams.get("orderNo")?.trim();
    if (!orderNo) {
      return fail("缺少订单号", 40000, 400);
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order || order.userId !== session.user.id) {
      return fail("订单不存在", 40400, 404);
    }

    const returnParams = pickAlipayReturnParams(req.nextUrl.searchParams);
    return await syncAlipayOrder(orderNo, returnParams);
  } catch (error) {
    console.error("[Payment Sync Error]", error);
    return fail("同步支付状态失败", 50000, 500);
  }
}