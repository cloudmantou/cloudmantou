import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { createAlipayPayment } from "@/lib/payment-providers";
import { detectPaymentScene, resolveAlipayMode, type PaymentScene } from "@/lib/payment-scene";

export const dynamic = "force-dynamic";

const LAUNCH_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; form-action https:; base-uri 'none'";

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

  if (order.status !== "PENDING") {
    return new NextResponse("订单状态不可支付", { status: 400 });
  }

  const scene = resolveScene(req, sceneParam);
  const amount = Number(order.amount);
  const notifyUrl = `${config.siteUrl}/api/payment/notify/alipay`;
  const returnUrl = `${config.siteUrl}/payment/result?orderNo=${encodeURIComponent(order.orderNo)}`;

  const launch = createAlipayPayment({
    config: config.alipay,
    mode: resolveAlipayMode(scene),
    orderNo: order.orderNo,
    title: order.title,
    amount,
    notifyUrl,
    returnUrl,
  });

  await prisma.payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      channel: "ALIPAY",
      amount: order.amount,
      status: "WAITING",
    },
    update: {
      channel: "ALIPAY",
      amount: order.amount,
      status: "WAITING",
    },
  });

  if (launch.type !== "form") {
    return new NextResponse("支付宝下单失败", { status: 500 });
  }

  return new NextResponse(launch.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": LAUNCH_CSP,
      "Cache-Control": "no-store",
    },
  });
}