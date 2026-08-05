import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { createAlipayPayment } from "@/lib/payment-providers";
import { detectPaymentScene, resolveAlipayMode, type PaymentScene } from "@/lib/payment-scene";
import {
  buildAlipayLaunchContentSecurityPolicy,
  resolveCspNonce,
} from "@/config/csp";
import { ensureOrderPayable, expireStalePendingOrders } from "@/lib/order-lifecycle";
import { claimPaymentChannel } from "@/lib/payment-channel";

export const dynamic = "force-dynamic";

function resolveScene(req: NextRequest, explicit: string | null): PaymentScene {
  if (explicit && explicit !== "auto") {
    return explicit as PaymentScene;
  }
  return detectPaymentScene(req.headers.get("user-agent") || "");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("请先登录", { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  const sceneParam = req.nextUrl.searchParams.get("scene");
  if (!orderId) {
    return new NextResponse("缺少订单参数", { status: 400 });
  }

  const config = await getPaymentRuntimeConfig();
  if (!config.alipay?.enabled) {
    return new NextResponse("支付宝未配置或未启用", { status: 400 });
  }

  await expireStalePendingOrders({ userId: session.user.id });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order || order.userId !== session.user.id) {
    return new NextResponse("订单不存在", { status: 404 });
  }

  if (order.status === "PAID") {
    return new NextResponse("订单已支付", { status: 400 });
  }

  const payable = await ensureOrderPayable(order);
  if (payable.expired) {
    return new NextResponse("订单已过期，请重新下单", { status: 400 });
  }

  if (order.status !== "PENDING") {
    return new NextResponse("订单状态不可支付", { status: 400 });
  }
  if (order.payment && order.payment.channel !== "ALIPAY") {
    return new NextResponse("该订单已绑定微信支付，请使用原渠道完成支付或重新下单", {
      status: 409,
    });
  }

  const scene = resolveScene(req, sceneParam);
  const scriptNonce = resolveCspNonce(req.headers.get("x-nonce"));
  const amount = Number(order.amount);
  const notifyUrl = `${config.siteUrl}/api/payment/notify/alipay`;
  const returnUrl = `${config.siteUrl}/payment/result?orderNo=${encodeURIComponent(order.orderNo)}`;

  const channelClaimed = await claimPaymentChannel({
    orderId: order.id,
    channel: "ALIPAY",
    amount: order.amount,
  });
  if (!channelClaimed) {
    return new NextResponse("该订单已绑定微信支付，请使用原渠道完成支付或重新下单", {
      status: 409,
    });
  }

  const launch = createAlipayPayment({
    config: config.alipay,
    mode: resolveAlipayMode(scene),
    orderNo: order.orderNo,
    title: order.title,
    amount,
    notifyUrl,
    returnUrl,
    scriptNonce,
  });

  if (launch.type !== "form") {
    return new NextResponse("支付宝下单失败", { status: 500 });
  }

  return new NextResponse(launch.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": buildAlipayLaunchContentSecurityPolicy(scriptNonce),
      "Cache-Control": "private, no-store",
    },
  });
}
