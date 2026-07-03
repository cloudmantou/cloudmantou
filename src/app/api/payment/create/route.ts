import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { createAlipayPayment, createWechatPayment } from "@/lib/payment-providers";
import {
  detectPaymentScene,
  resolveAlipayMode,
  resolveWechatMode,
  type PaymentScene,
} from "@/lib/payment-scene";

const createSchema = z.object({
  orderId: z.string().min(1),
  channel: z.enum(["ALIPAY", "WECHAT"]),
  scene: z.enum(["pc", "h5", "wechat_inapp", "auto"]).optional(),
});

function resolveScene(req: NextRequest, explicit?: string): PaymentScene {
  if (explicit && explicit !== "auto") {
    return explicit as PaymentScene;
  }
  return detectPaymentScene(req.headers.get("user-agent") || "");
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { orderId, channel } = parsed.data;
    const scene = resolveScene(req, parsed.data.scene);
    const config = await getPaymentRuntimeConfig();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order || order.userId !== session.user.id) {
      return fail("订单不存在", 40400, 404);
    }

    if (order.status === "PAID") {
      return fail("订单已支付", 40000, 400);
    }

    if (order.status !== "PENDING") {
      return fail("订单状态不可支付", 40000, 400);
    }

    const amount = Number(order.amount);
    const notifyUrl = `${config.siteUrl}/api/payment/notify/${channel === "ALIPAY" ? "alipay" : "wechat"}`;
    const returnUrl = `${config.siteUrl}/payment/result?orderNo=${encodeURIComponent(order.orderNo)}`;

    // 测试模式：无论真实网关是否配置，一律走模拟支付
    if (config.testMode) {
      await prisma.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          channel,
          amount: order.amount,
          status: "WAITING",
        },
        update: {
          channel,
          amount: order.amount,
          status: "WAITING",
        },
      });
      return ok({
        type: "test",
        mode: channel === "ALIPAY" ? "alipay_test" : "wechat_test",
        scene,
        testPayUrl: `/api/payment/test-pay`,
        orderId: order.id,
        orderNo: order.orderNo,
      });
    }

    let launch;

    if (channel === "ALIPAY") {
      if (!config.alipay?.enabled) {
        return fail("支付宝未配置或未启用", 40000, 400);
      }
      const mode = resolveAlipayMode(scene);
      launch = createAlipayPayment({
        config: config.alipay,
        mode,
        orderNo: order.orderNo,
        title: order.title,
        amount,
        notifyUrl,
        returnUrl,
      });
    } else {
      if (!config.wechat?.enabled) {
        return fail("微信支付未配置或未启用", 40000, 400);
      }
      const mode = resolveWechatMode(scene);
      launch = await createWechatPayment({
        config: config.wechat,
        mode,
        orderNo: order.orderNo,
        title: order.title,
        amount,
        notifyUrl,
        clientIp: clientIp(req),
        returnUrl: mode === "mweb" ? returnUrl : undefined,
      });
    }

    await prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        channel,
        amount: order.amount,
        status: "WAITING",
      },
      update: {
        channel,
        amount: order.amount,
        status: "WAITING",
      },
    });

    return ok({
      ...launch,
      scene,
      orderNo: order.orderNo,
      amount,
      title: order.title,
    });
  } catch (error) {
    console.error("[Payment Create Error]", error);
    const message = error instanceof Error ? error.message : "发起支付失败";
    return fail(message, 50000, 500);
  }
}