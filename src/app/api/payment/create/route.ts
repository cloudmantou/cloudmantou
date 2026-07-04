import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { createWechatPayment } from "@/lib/payment-providers";
import { ensureOrderPayable, expireStalePendingOrders } from "@/lib/order-lifecycle";
import { getClientIP } from "@/lib/rate-limit";
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

    await expireStalePendingOrders({ userId: session.user.id });

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

    const payable = await ensureOrderPayable(order);
    if (payable.expired) {
      return fail("订单已过期，请重新下单", 40000, 400);
    }

    if (order.status !== "PENDING") {
      return fail("订单状态不可支付", 40000, 400);
    }

    if (order.payment && order.payment.channel !== channel) {
      return fail("该订单已绑定其他支付渠道，请使用原渠道完成支付或重新下单", 40000, 400);
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
        type: "navigate",
        url: `/payment/alipay-launch?orderId=${encodeURIComponent(order.id)}&scene=${encodeURIComponent(scene)}`,
        mode: mode === "page" ? "alipay_pc" : "alipay_h5",
        scene,
        orderNo: order.orderNo,
        amount,
        title: order.title,
      });
    } else {
      if (!config.wechat?.enabled) {
        return fail("微信支付未配置或未启用", 40000, 400);
      }
      const mode = resolveWechatMode(scene);
      if (!mode) {
        return fail("微信内支付需 JSAPI（openid），当前请使用支付宝或在外部浏览器打开", 40000, 400);
      }
      launch = await createWechatPayment({
        config: config.wechat,
        mode,
        orderNo: order.orderNo,
        title: order.title,
        amount,
        notifyUrl,
        clientIp: getClientIP(req),
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