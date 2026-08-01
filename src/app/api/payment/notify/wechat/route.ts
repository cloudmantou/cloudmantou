import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentRuntimeConfig } from "@/lib/payment-config";
import {
  verifyWechatSign,
  verifyWechatV3Sign,
  verifyAmount,
  finalizePaidOrder,
  decryptWechatV3Resource,
} from "@/lib/payment";
import { recordPaymentNotifyAudit } from "@/lib/payment-notify-audit";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";
import {
  findWechatV3MerchantMismatch,
  wechatNotifyFailure,
  wechatNotifySuccess,
  type WechatNotifyVersion,
} from "@/lib/wechat-notify";

/**
 * 微信支付异步通知回调（兼容 V2 XML 与 V3 JSON）
 */
export async function POST(req: NextRequest) {
  let rawBody = "";
  const contentType = req.headers.get("content-type") || "";
  const version = detectWechatNotifyVersion(req.headers, contentType);

  try {
    const paymentConfig = await getPaymentRuntimeConfig();
    rawBody = await readRequestBodyWithLimit(req);
    let body: Record<string, any>;

    if (version === "v3") {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return wechatNotifyFailure(version, "无效的请求格式");
      }

      const timestamp = req.headers.get("wechatpay-timestamp") || "";
      const nonce = req.headers.get("wechatpay-nonce") || "";
      const signature = req.headers.get("wechatpay-signature") || "";
      const serial = req.headers.get("wechatpay-serial") || "";

      const wechatPublicKey =
        paymentConfig.wechat?.publicKey || process.env.WECHAT_V3_PUBLIC_KEY;
      if (!wechatPublicKey) {
        console.error("[WeChat] WECHAT_V3_PUBLIC_KEY not configured");
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "CONFIG_MISSING",
          reason: "v3_public_key_not_configured",
          rawBody,
        });
        return wechatNotifyFailure(version, "配置错误", 500);
      }

      if (
        !verifyWechatV3Sign(timestamp, nonce, rawBody, signature, serial, wechatPublicKey, {
          expectedSerial: paymentConfig.wechat?.platformSerial,
          maxSkewSec: 300,
        })
      ) {
        console.warn("[WeChat v3] Signature verification failed");
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "SIGN_FAILED",
          reason: "v3",
          rawBody,
        });
        return wechatNotifyFailure(version, "签名验证失败", 401);
      }

      const apiV3Key =
        paymentConfig.wechat?.apiV3Key || process.env.WECHAT_API_V3_KEY || "";
      if (!apiV3Key) {
        return wechatNotifyFailure(version, "配置错误", 500);
      }
      if (!body.resource) {
        return wechatNotifyFailure(version, "缺少加密资源");
      }
      try {
        body = decryptWechatV3Resource(body.resource, apiV3Key);
      } catch (err) {
        console.error("[WeChat v3 Decrypt Error]", err);
        return wechatNotifyFailure(version, "解密失败");
      }

      const expectedAppId =
        paymentConfig.wechat?.appId || process.env.WECHAT_APP_ID || "";
      const expectedMchId =
        paymentConfig.wechat?.mchId || process.env.WECHAT_MCH_ID || "";
      if (!expectedAppId || !expectedMchId) {
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "CONFIG_MISSING",
          reason: "v3_merchant_identity_not_configured",
          rawBody,
        });
        return wechatNotifyFailure(version, "配置错误", 500);
      }

      const merchantMismatch = findWechatV3MerchantMismatch(body, {
        appId: expectedAppId,
        mchId: expectedMchId,
      });
      if (merchantMismatch) {
        console.warn(`[WeChat v3] ${merchantMismatch} mismatch`);
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "MERCHANT_MISMATCH",
          reason: `v3_${merchantMismatch}_mismatch`,
          rawBody,
        });
        return wechatNotifyFailure(version, `${merchantMismatch} mismatch`);
      }
    } else {
      const isXml =
        contentType.includes("xml") || rawBody.trim().startsWith("<xml");
      if (!isXml) {
        console.warn("[WeChat v2] Rejected non-XML callback", { contentType });
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "INVALID_CONTENT_TYPE",
          reason: contentType,
          rawBody,
        });
        return wechatNotifyFailure(version, "invalid content type");
      }

      body = parseXmlBody(rawBody);

      const apiKey = paymentConfig.wechat?.apiKey || process.env.WECHAT_API_KEY;
      if (!apiKey) {
        console.error("[WeChat] WECHAT_API_KEY not configured");
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          status: "CONFIG_MISSING",
          reason: "v2_api_key_not_configured",
          rawBody,
        });
        return wechatNotifyFailure(version, "配置错误", 500);
      }

      if (!verifyWechatSign(body, apiKey)) {
        console.warn("[WeChat v2] Signature verification failed");
        await recordPaymentNotifyAudit({
          channel: "WECHAT",
          orderNo: body.out_trade_no,
          status: "SIGN_FAILED",
          reason: "v2",
          rawBody,
        });
        return wechatNotifyFailure(version, "签名验证失败", 401);
      }

      const expectedAppId = paymentConfig.wechat?.appId;
      if (expectedAppId && body.appid !== expectedAppId) {
        console.warn("[WeChat v2] appid mismatch:", body.appid, "expected:", expectedAppId);
        return wechatNotifyFailure(version, "appid mismatch");
      }

      const expectedMchId = paymentConfig.wechat?.mchId;
      if (expectedMchId && body.mch_id !== expectedMchId) {
        console.warn("[WeChat v2] mch_id mismatch:", body.mch_id, "expected:", expectedMchId);
        return wechatNotifyFailure(version, "mch mismatch");
      }
    }

    const out_trade_no = body.out_trade_no;
    const transaction_id = body.transaction_id;
    const trade_state = body.trade_state || body.result_code;
    const total_fee = body.total_fee;
    const amount_total = body.amount?.total;

    if (!out_trade_no || !transaction_id) {
      return wechatNotifyFailure(version, "参数不完整");
    }

    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      console.warn("[WeChat] Unknown order:", out_trade_no);
      return wechatNotifyFailure(version, "订单不存在", 404);
    }

    if (order.status !== "PENDING" && order.status !== "PAID") {
      return wechatNotifyFailure(version, "订单状态异常", 409);
    }

    const paidAmountYuan = version === "v3"
      ? (parseInt(amount_total) / 100).toFixed(2)
      : (parseInt(total_fee) / 100).toFixed(2);

    if (!verifyAmount(order.amount, paidAmountYuan)) {
      console.warn("[WeChat] Amount mismatch:", {
        orderNo: out_trade_no,
        orderAmount: order.amount.toString(),
        paidAmount: paidAmountYuan,
      });
      return wechatNotifyFailure(version, "金额不匹配");
    }

    const isPaid =
      (version === "v3" && trade_state === "SUCCESS") ||
      (version === "v2" && body.result_code === "SUCCESS" && body.return_code === "SUCCESS");

    if (!isPaid) {
      return wechatNotifySuccess(version);
    }

    await finalizePaidOrder({
      order,
      channel: "WECHAT",
      tradeNo: transaction_id,
      rawCallback: rawBody,
    });

    return wechatNotifySuccess(version);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      if (version === "v3") {
        return wechatNotifyFailure(version, "请求体过大", 413);
      }
      return new Response("payload too large", { status: 413 });
    }
    console.error("[WeChat Notify Error]", error);
    await recordPaymentNotifyAudit({
      channel: "WECHAT",
      status: "ERROR",
      reason: error instanceof Error ? error.message : "unknown",
      rawBody,
    });
    return wechatNotifyFailure(version, "处理失败", 500);
  }
}

function detectWechatNotifyVersion(
  headers: Headers,
  contentType: string
): WechatNotifyVersion {
  const hasV3Header = [
    "wechatpay-signature",
    "wechatpay-timestamp",
    "wechatpay-nonce",
    "wechatpay-serial",
  ].some((name) => headers.has(name));
  return contentType.includes("json") || hasV3Header ? "v3" : "v2";
}

function parseXmlBody(xml: string): Record<string, any> {
  const result: Record<string, any> = {};
  // WeChat V2 permits both CDATA and ordinary text nodes (notably numeric
  // fields such as total_fee). Keep this deliberately non-recursive so DTDs,
  // entities and nested attacker-controlled XML are never evaluated.
  const regex = /<([A-Za-z_][\w.-]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2] ?? decodeXmlText(match[3] ?? "");
  }
  return result;
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_match, entity: string) => ({
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    })[entity] ?? ""
  );
}
