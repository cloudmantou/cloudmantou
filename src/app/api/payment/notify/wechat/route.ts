import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import { verifyWechatSign, verifyWechatV3Sign, verifyAmount, grantEntitlement } from "@/lib/payment";

/**
 * 微信支付异步通知回调
 *
 * 微信支付 v2: XML 或 JSON 格式，MD5 签名
 * 微信支付 v3: JSON 格式，SHA256-RSA2048 签名，请求头包含签名信息
 *
 * 本接口同时兼容 v2 和 v3 格式。
 * 返回 XML: <xml><return_code><![CDATA[SUCCESS]]></return_code></xml>
 */
export async function POST(req: NextRequest) {
  let rawBody = "";

  try {
    const paymentConfig = await getPaymentRuntimeConfig();
    rawBody = await req.text();
    let body: Record<string, any>;
    let isV3 = false;

    // 判断 v2 还是 v3
    const contentType = req.headers.get("content-type") || "";

    if (req.headers.get("wechatpay-signature")) {
      // ===== 微信支付 v3 =====
      isV3 = true;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return wechatV2Response("FAIL", "无效的请求格式");
      }

      // v3 签名验证
      const timestamp = req.headers.get("wechatpay-timestamp") || "";
      const nonce = req.headers.get("wechatpay-nonce") || "";
      const signature = req.headers.get("wechatpay-signature") || "";
      const serial = req.headers.get("wechatpay-serial") || "";

      const wechatPublicKey = paymentConfig.wechat?.publicKey || process.env.WECHAT_V3_PUBLIC_KEY;
      if (!wechatPublicKey) {
        console.error("[WeChat] WECHAT_V3_PUBLIC_KEY not configured");
        return wechatV2Response("FAIL", "配置错误");
      }

      if (
        !verifyWechatV3Sign(timestamp, nonce, rawBody, signature, serial, wechatPublicKey, {
          expectedSerial: paymentConfig.wechat?.platformSerial,
          maxSkewSec: 300,
        })
      ) {
        console.warn("[WeChat v3] Signature verification failed");
        return wechatV2Response("FAIL", "签名验证失败");
      }

      // v3 解密 resource
      if (body.resource) {
        const apiKey = paymentConfig.wechat?.apiKey || process.env.WECHAT_API_KEY;
        if (!apiKey) {
          return wechatV2Response("FAIL", "配置错误");
        }
        body = decryptWechatV3Resource(body.resource, apiKey);
      }
    } else {
      // ===== 微信支付 v2 =====
      if (contentType.includes("xml")) {
        body = parseXmlBody(rawBody);
      } else {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = Object.fromEntries(new URLSearchParams(rawBody));
        }
      }

      // v2 签名验证
      const apiKey = paymentConfig.wechat?.apiKey || process.env.WECHAT_API_KEY;
      if (!apiKey) {
        console.error("[WeChat] WECHAT_API_KEY not configured");
        return wechatV2Response("FAIL", "配置错误");
      }

      if (!verifyWechatSign(body, apiKey)) {
        console.warn("[WeChat v2] Signature verification failed");
        return wechatV2Response("FAIL", "签名验证失败");
      }
    }

    // ===== 通用字段提取 =====
    const out_trade_no = body.out_trade_no;
    const transaction_id = body.transaction_id;
    const trade_state = body.trade_state || body.result_code;
    const total_fee = body.total_fee; // v2: 分
    const amount_total = body.amount?.total; // v3: 分

    if (!out_trade_no || !transaction_id) {
      return wechatV2Response("FAIL", "参数不完整");
    }

    // ===== 查找订单 =====
    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      console.warn("[WeChat] Unknown order:", out_trade_no);
      return wechatV2Response("FAIL", "订单不存在");
    }

    // 幂等
    if (order.status === "PAID") {
      return wechatV2Response("SUCCESS");
    }

    if (order.status !== "PENDING") {
      return wechatV2Response("FAIL", "订单状态异常");
    }

    // ===== 金额校验 =====
    // v2: total_fee 单位是分，需要除以 100
    // v3: amount.total 单位是分
    const paidAmountYuan = isV3
      ? (parseInt(amount_total) / 100).toFixed(2)
      : (parseInt(total_fee) / 100).toFixed(2);

    if (!verifyAmount(order.amount, paidAmountYuan)) {
      console.warn("[WeChat] Amount mismatch:", {
        orderNo: out_trade_no,
        orderAmount: order.amount.toString(),
        paidAmount: paidAmountYuan,
      });
      return wechatV2Response("FAIL", "金额不匹配");
    }

    // ===== 检查支付状态 =====
    // v2: result_code=SUCCESS 且 trade_state=SUCCESS
    // v3: trade_state=SUCCESS
    const isPaid =
      (isV3 && trade_state === "SUCCESS") ||
      (!isV3 && body.result_code === "SUCCESS" && body.return_code === "SUCCESS");

    if (!isPaid) {
      return wechatV2Response("SUCCESS");
    }

    // ===== 事务处理 =====
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });

      if (updated.count === 0) return;

      const paymentData = {
        orderId: order.id,
        channel: "WECHAT" as const,
        amount: order.amount,
        tradeNo: transaction_id,
        status: "SUCCESS" as const,
        rawCallback: rawBody,
      };

      if (order.payment) {
        await tx.payment.update({ where: { orderId: order.id }, data: paymentData });
      } else {
        await tx.payment.create({ data: paymentData });
      }

      await grantEntitlement(tx, order);
    });

    return wechatV2Response("SUCCESS");
  } catch (error) {
    console.error("[WeChat Notify Error]", error);
    return wechatV2Response("FAIL", "处理失败");
  }
}

// ===== 辅助函数 =====

function wechatV2Response(returnCode: string, returnMsg?: string): Response {
  const msg = returnMsg || "";
  const xml = `<xml><return_code><![CDATA[${returnCode}]]></return_code><return_msg><![CDATA[${msg}]]></return_msg></xml>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

function parseXmlBody(xml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

function decryptWechatV3Resource(resource: any, apiKey: string): Record<string, any> {
  try {
    const { ciphertext, nonce, associated_data } = resource;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(apiKey, "base64"),
      Buffer.from(nonce, "utf8")
    );
    decipher.setAAD(Buffer.from(associated_data, "utf8"));

    const tag = Buffer.from(ciphertext, "base64").slice(-16);
    const data = Buffer.from(ciphertext, "base64").slice(0, -16);

    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (err) {
    console.error("[WeChat v3 Decrypt Error]", err);
    return {};
  }
}

import crypto from "crypto";
