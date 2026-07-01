import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAlipaySign, verifyAmount, grantEntitlement } from "@/lib/payment";

/**
 * 支付宝异步通知回调
 *
 * 接收 application/x-www-form-urlencoded 格式的 POST 请求
 * 返回纯文本 "success" 或 "failure"
 *
 * 处理顺序（参考支付宝文档）：
 * 1. 校验 out_trade_no 是否存在
 * 2. 幂等：已支付直接返回 success
 * 3. 验签（RSA2 / SHA256WithRSA）
 * 4. 验证 app_id、seller_id
 * 5. 验证 total_amount 与订单金额一致
 * 6. 检查 trade_status = TRADE_SUCCESS 或 TRADE_FINISHED
 * 7. 事务内更新订单 + 发放权益
 * 8. 返回 "success"
 */
export async function POST(req: NextRequest) {
  let rawBody = "";

  try {
    rawBody = await req.text();
    const params = Object.fromEntries(new URLSearchParams(rawBody));

    const {
      app_id,
      seller_id,
      out_trade_no,
      trade_no,
      trade_status,
      total_amount,
      sign,
      sign_type,
    } = params;

    // ===== 1. 基础参数校验 =====
    if (!out_trade_no || !trade_no || !trade_status) {
      return new Response("failure", { status: 200 });
    }

    // ===== 2. 查找订单 =====
    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      console.warn("[Alipay] Unknown order:", out_trade_no);
      return new Response("failure", { status: 200 });
    }

    // ===== 3. 幂等：已支付直接返回 success =====
    if (order.status === "PAID") {
      return new Response("success", { status: 200 });
    }

    if (order.status !== "PENDING") {
      console.warn("[Alipay] Order status not PENDING:", out_trade_no, order.status);
      return new Response("failure", { status: 200 });
    }

    // ===== 4. 验签 =====
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
    if (!alipayPublicKey) {
      console.error("[Alipay] ALIPAY_PUBLIC_KEY not configured");
      return new Response("failure", { status: 200 });
    }

    if (!verifyAlipaySign(params, alipayPublicKey)) {
      console.warn("[Alipay] Signature verification failed:", out_trade_no);
      return new Response("failure", { status: 200 });
    }

    // ===== 5. 验证 app_id =====
    const expectedAppId = process.env.ALIPAY_APP_ID;
    if (expectedAppId && app_id !== expectedAppId) {
      console.warn("[Alipay] app_id mismatch:", app_id, "expected:", expectedAppId);
      return new Response("failure", { status: 200 });
    }

    // ===== 6. 验证 seller_id =====
    const expectedSellerId = process.env.ALIPAY_SELLER_ID;
    if (expectedSellerId && seller_id !== expectedSellerId) {
      console.warn("[Alipay] seller_id mismatch:", seller_id);
      return new Response("failure", { status: 200 });
    }

    // ===== 7. 验证金额（关键安全校验） =====
    if (!verifyAmount(order.amount, total_amount)) {
      console.warn("[Alipay] Amount mismatch:", {
        orderNo: out_trade_no,
        orderAmount: order.amount.toString(),
        paidAmount: total_amount,
      });
      return new Response("failure", { status: 200 });
    }

    // ===== 8. 只处理支付成功的状态 =====
    // TRADE_SUCCESS: 支付成功（可退款）
    // TRADE_FINISHED: 交易完成（不可退款）
    if (trade_status !== "TRADE_SUCCESS" && trade_status !== "TRADE_FINISHED") {
      // WAIT_BUYER_PAY / TRADE_CLOSED 等不处理，但返回 success 防止重试
      return new Response("success", { status: 200 });
    }

    // ===== 9. 事务内更新订单 + 记录支付 + 发放权益 =====
    await prisma.$transaction(async (tx) => {
      // 条件更新防止并发
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });

      if (updated.count === 0) {
        // 已被其他回调处理
        return;
      }

      // 记录支付信息
      const paymentData = {
        orderId: order.id,
        channel: "ALIPAY" as const,
        amount: order.amount,
        tradeNo: trade_no,
        status: "SUCCESS" as const,
        rawCallback: rawBody,
      };

      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: paymentData,
        });
      } else {
        await tx.payment.create({ data: paymentData });
      }

      // 发放权益
      await grantEntitlement(tx, order);
    });

    // ===== 10. 返回纯文本 success =====
    return new Response("success", { status: 200 });
  } catch (error) {
    console.error("[Alipay Notify Error]", error);
    // 出错返回 failure，支付宝会重试（最多 8 次，约 25 小时）
    return new Response("failure", { status: 200 });
  }
}
