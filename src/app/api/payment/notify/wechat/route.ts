import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import {
  verifyWechatSign,
  verifyWechatV3Sign,
  verifyAmount,
  grantEntitlement,
  decryptWechatV3Resource,
} from "@/lib/payment";

/**
 * 微信支付异步通知回调（兼容 V2 XML 与 V3 JSON）
 */
export async function POST(req: NextRequest) {
  let rawBody = "";

  try {
    const paymentConfig = await getPaymentRuntimeConfig();
    rawBody = await req.text();
    let body: Record<string, any>;
    let isV3 = false;

    const contentType = req.headers.get("content-type") || "";

    if (req.headers.get("wechatpay-signature")) {
      isV3 = true;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return wechatV2Response("FAIL", "无效的请求格式");
      }

      const timestamp = req.headers.get("wechatpay-timestamp") || "";
      const nonce = req.headers.get("wechatpay-nonce") || "";
      const signature = req.headers.get("wechatpay-signature") || "";
      const serial = req.headers.get("wechatpay-serial") || "";

      const wechatPublicKey =
        paymentConfig.wechat?.publicKey || process.env.WECHAT_V3_PUBLIC_KEY;
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

      if (body.resource) {
        const apiV3Key =
          paymentConfig.wechat?.apiV3Key || process.env.WECHAT_API_V3_KEY || "";
        if (!apiV3Key) {
          return wechatV2Response("FAIL", "配置错误");
        }
        try {
          body = decryptWechatV3Resource(body.resource, apiV3Key);
        } catch (err) {
          console.error("[WeChat v3 Decrypt Error]", err);
          return wechatV2Response("FAIL", "解密失败");
        }
      }
    } else {
      const isXml =
        contentType.includes("xml") || rawBody.trim().startsWith("<xml");
      if (!isXml) {
        console.warn("[WeChat v2] Rejected non-XML callback", { contentType });
        return wechatV2Response("FAIL", "invalid content type");
      }

      body = parseXmlBody(rawBody);

      const apiKey = paymentConfig.wechat?.apiKey || process.env.WECHAT_API_KEY;
      if (!apiKey) {
        console.error("[WeChat] WECHAT_API_KEY not configured");
        return wechatV2Response("FAIL", "配置错误");
      }

      if (!verifyWechatSign(body, apiKey)) {
        console.warn("[WeChat v2] Signature verification failed");
        return wechatV2Response("FAIL", "签名验证失败");
      }

      const expectedAppId = paymentConfig.wechat?.appId;
      if (expectedAppId && body.appid !== expectedAppId) {
        console.warn("[WeChat v2] appid mismatch:", body.appid, "expected:", expectedAppId);
        return wechatV2Response("FAIL", "appid mismatch");
      }

      const expectedMchId = paymentConfig.wechat?.mchId;
      if (expectedMchId && body.mch_id !== expectedMchId) {
        console.warn("[WeChat v2] mch_id mismatch:", body.mch_id, "expected:", expectedMchId);
        return wechatV2Response("FAIL", "mch mismatch");
      }
    }

    const out_trade_no = body.out_trade_no;
    const transaction_id = body.transaction_id;
    const trade_state = body.trade_state || body.result_code;
    const total_fee = body.total_fee;
    const amount_total = body.amount?.total;

    if (!out_trade_no || !transaction_id) {
      return wechatV2Response("FAIL", "参数不完整");
    }

    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      console.warn("[WeChat] Unknown order:", out_trade_no);
      return wechatV2Response("FAIL", "订单不存在");
    }

    if (order.status === "PAID") {
      return wechatV2Response("SUCCESS");
    }

    if (order.status !== "PENDING") {
      return wechatV2Response("FAIL", "订单状态异常");
    }

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

    const isPaid =
      (isV3 && trade_state === "SUCCESS") ||
      (!isV3 && body.result_code === "SUCCESS" && body.return_code === "SUCCESS");

    if (!isPaid) {
      return wechatV2Response("SUCCESS");
    }

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