import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { verifyAlipaySign, verifyAmount, finalizeAlipayOrder } from "@/lib/payment";

/**
 * 支付宝异步通知回调
 *
 * 接收 application/x-www-form-urlencoded 格式的 POST 请求
 * 返回纯文本 "success" 或 "failure"
 */
export async function POST(req: NextRequest) {
  let rawBody = "";

  try {
    const paymentConfig = await getPaymentRuntimeConfig();
    const alipayConfig = paymentConfig.alipay;

    rawBody = await req.text();
    const params = Object.fromEntries(new URLSearchParams(rawBody));

    const {
      app_id,
      seller_id,
      out_trade_no,
      trade_no,
      trade_status,
      total_amount,
    } = params;

    if (!out_trade_no || !trade_no || !trade_status) {
      return new Response("failure", { status: 200 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      console.warn("[Alipay] Unknown order:", out_trade_no);
      return new Response("failure", { status: 200 });
    }

    if (order.status === "PAID") {
      return new Response("success", { status: 200 });
    }

    if (order.status !== "PENDING") {
      console.warn("[Alipay] Order status not PENDING:", out_trade_no, order.status);
      return new Response("failure", { status: 200 });
    }

    const alipayPublicKey = alipayConfig?.publicKey;
    if (!alipayPublicKey) {
      console.error("[Alipay] Public key not configured");
      return new Response("failure", { status: 200 });
    }

    if (!verifyAlipaySign(params, alipayPublicKey)) {
      console.warn("[Alipay] Signature verification failed:", out_trade_no);
      return new Response("failure", { status: 200 });
    }

    const expectedAppId = alipayConfig?.appId;
    if (expectedAppId && app_id !== expectedAppId) {
      console.warn("[Alipay] app_id mismatch:", app_id, "expected:", expectedAppId);
      return new Response("failure", { status: 200 });
    }

    const expectedSellerId = alipayConfig?.sellerId;
    if (expectedSellerId && seller_id !== expectedSellerId) {
      console.warn("[Alipay] seller_id mismatch:", seller_id);
      return new Response("failure", { status: 200 });
    }

    if (!verifyAmount(order.amount, total_amount)) {
      console.warn("[Alipay] Amount mismatch:", {
        orderNo: out_trade_no,
        orderAmount: order.amount.toString(),
        paidAmount: total_amount,
      });
      return new Response("failure", { status: 200 });
    }

    if (trade_status !== "TRADE_SUCCESS" && trade_status !== "TRADE_FINISHED") {
      return new Response("success", { status: 200 });
    }

    await finalizeAlipayOrder({
      order,
      tradeNo: trade_no,
      rawCallback: rawBody,
    });

    return new Response("success", { status: 200 });
  } catch (error) {
    console.error("[Alipay Notify Error]", error);
    return new Response("failure", { status: 200 });
  }
}