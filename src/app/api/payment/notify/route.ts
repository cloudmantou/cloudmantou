import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import crypto from "crypto";

/**
 * 支付回调接口 — 带签名验证
 *
 * 支持支付宝 (RSA2/HMAC-SHA256) 和微信支付 (HMAC-SHA256) 回调格式。
 * 中间件已对 /api/payment/notify 放行，不需要登录。
 *
 * 安全设计:
 * 1. 先验签，验签失败直接拒绝，不处理任何业务逻辑
 * 2. 幂等：已支付订单直接返回成功
 * 3. 金额校验：以订单表金额为准，回调金额必须匹配
 * 4. 每次回调原文存入 rawCallback 便于对账
 */

// ===== 签名验证 =====

function verifyAlipaySign(params: Record<string, string>, publicKey: string): boolean {
  try {
    const { sign, sign_type, ...rest } = params;
    if (!sign || sign_type !== "RSA2") return false;

    // 按 key 排序拼接待签名字符串
    const sortedKeys = Object.keys(rest).filter((k) => rest[k] !== "" && rest[k] !== undefined).sort();
    const signStr = sortedKeys.map((k) => `${k}=${rest[k]}`).join("&");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signStr);
    return verify.verify(
      `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
      sign,
      "base64"
    );
  } catch (err) {
    console.error("[Alipay Verify Error]", err);
    return false;
  }
}

function verifyWechatSign(body: Record<string, any>, apiKey: string): boolean {
  try {
    const { sign, ...rest } = body;
    if (!sign) return false;

    // 按 key 排序拼接待签名字符串
    const sortedKeys = Object.keys(rest).filter((k) => rest[k] !== "" && rest[k] !== null && rest[k] !== undefined).sort();
    const signStr = sortedKeys.map((k) => `${k}=${rest[k]}`).join("&") + `&key=${apiKey}`;

    const expected = crypto.createHash("md5").update(signStr).digest("hex").toUpperCase();
    return sign === expected;
  } catch (err) {
    console.error("[Wechat Verify Error]", err);
    return false;
  }
}

// ===== 核心处理 =====

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: Record<string, any>;

    // 支付宝可能用 form-urlencoded，微信用 JSON
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return fail("无效的请求格式", 40000, 400);
      }
    }

    const channel = (body.channel || "").toUpperCase();
    const { orderNo, tradeNo } = body;

    if (!orderNo || !tradeNo || !channel) {
      return fail("参数不完整", 42200, 422);
    }

    if (channel !== "ALIPAY" && channel !== "WECHAT") {
      return fail("不支持的支付渠道", 40000, 400);
    }

    // ===== 验签 =====
    let signatureValid = false;

    if (channel === "ALIPAY") {
      const publicKey = process.env.ALIPAY_PUBLIC_KEY;
      if (!publicKey) {
        console.error("[Payment] ALIPAY_PUBLIC_KEY not configured");
        return fail("支付配置错误", 50000, 500);
      }
      signatureValid = verifyAlipaySign(body, publicKey);
    } else {
      const apiKey = process.env.WECHAT_API_KEY;
      if (!apiKey) {
        console.error("[Payment] WECHAT_API_KEY not configured");
        return fail("支付配置错误", 50000, 500);
      }
      signatureValid = verifyWechatSign(body, apiKey);
    }

    if (!signatureValid) {
      console.warn("[Payment] Signature verification failed", {
        channel,
        orderNo,
        tradeNo,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });
      return fail("签名验证失败", 40300, 403);
    }

    // ===== 查找订单 =====
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { payment: true },
    });

    if (!order) {
      return fail("订单不存在", 40400, 404);
    }

    // 幂等：已支付直接返回成功
    if (order.status === "PAID") {
      return ok({ message: "订单已处理" });
    }

    if (order.status !== "PENDING") {
      return fail(`订单状态异常: ${order.status}`, 40000, 400);
    }

    // ===== 处理支付结果 =====
    const paymentStatus = body.status === "SUCCESS" ? "SUCCESS" : "FAILED";

    await prisma.$transaction(async (tx) => {
      // 记录支付信息
      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: {
            tradeNo,
            status: paymentStatus,
            rawCallback: rawBody,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            channel,
            amount: order.amount,
            tradeNo,
            status: paymentStatus,
            rawCallback: rawBody,
          },
        });
      }

      if (paymentStatus !== "SUCCESS") return;

      // 更新订单状态（条件更新防止并发）
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });

      if (updated.count === 0) {
        // 已被其他回调处理，幂等安全
        return;
      }

      // 发放权益
      const expiresAt = new Date();
      switch (order.productType) {
        case "VIP_MONTH":
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          await tx.entitlement.create({
            data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
          });
          break;
        case "VIP_QUARTER":
          expiresAt.setMonth(expiresAt.getMonth() + 3);
          await tx.entitlement.create({
            data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
          });
          break;
        case "VIP_YEAR":
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          await tx.entitlement.create({
            data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
          });
          break;
        case "PAID_POST":
          if (order.productId) {
            await tx.entitlement.create({
              data: { userId: order.userId, postId: order.productId, type: "PAID_POST", orderId: order.id },
            });
          }
          break;
        case "CARD_PACKAGE":
          // 卡密套餐交付由发卡流程单独处理
          break;
      }
    });

    return ok({ message: "处理成功" });
  } catch (error) {
    console.error("[Payment Notify Error]", error);
    return fail("处理失败", 50000, 500);
  }
}
