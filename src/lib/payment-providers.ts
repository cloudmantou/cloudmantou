import crypto from "crypto";
import {
  getAlipayGatewayUrl,
  isPemEncoded,
  normalizePem,
  type AlipayGatewayConfig,
  type WechatGatewayConfig,
} from "@/lib/payment-config";
import type { AlipayPayMode, WechatPayMode } from "@/lib/payment-scene";

export type PaymentLaunchResult =
  | { type: "form"; html: string; mode: string }
  | { type: "redirect"; url: string; mode: string }
  | { type: "qrcode"; codeUrl: string; mode: string };

function formatAmountYuan(amount: number): string {
  return amount.toFixed(2);
}

function signAlipay(params: Record<string, string>, privateKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort();
  const content = sorted.map((k) => `${k}=${params[k]}`).join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  return signer.sign(privateKey, "base64");
}

function buildAlipayForm(gatewayUrl: string, params: Record<string, string>): string {
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}" />`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>跳转支付宝</title></head><body><form id="alipay" method="post" action="${gatewayUrl}">${inputs}</form><script>document.getElementById('alipay').submit();</script></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createAlipayPayment(input: {
  config: AlipayGatewayConfig;
  mode: AlipayPayMode;
  orderNo: string;
  title: string;
  amount: number;
  notifyUrl: string;
  returnUrl: string;
}): PaymentLaunchResult {
  const method = input.mode === "page" ? "alipay.trade.page.pay" : "alipay.trade.wap.pay";
  const productCode = input.mode === "page" ? "FAST_INSTANT_TRADE_PAY" : "QUICK_WAP_WAY";
  const gatewayUrl = getAlipayGatewayUrl(input.config.env);

  const bizContent = JSON.stringify({
    out_trade_no: input.orderNo,
    total_amount: formatAmountYuan(input.amount),
    subject: input.title.slice(0, 128),
    product_code: productCode,
  });

  const params: Record<string, string> = {
    app_id: input.config.appId,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    biz_content: bizContent,
  };

  const privateKey = isPemEncoded(input.config.privateKey)
    ? input.config.privateKey
    : normalizePem(input.config.privateKey, "private");
  params.sign = signAlipay(params, privateKey);

  const html = buildAlipayForm(gatewayUrl, params);
  return { type: "form", html, mode: input.mode === "page" ? "alipay_pc" : "alipay_h5" };
}

export type AlipayTradeQueryResult = {
  paid: boolean;
  tradeNo?: string;
  totalAmount?: string;
  tradeStatus?: string;
  raw: string;
  message?: string;
};

export async function queryAlipayTrade(input: {
  config: AlipayGatewayConfig;
  orderNo: string;
}): Promise<AlipayTradeQueryResult> {
  const gatewayUrl = getAlipayGatewayUrl(input.config.env);
  const privateKey = isPemEncoded(input.config.privateKey)
    ? input.config.privateKey
    : normalizePem(input.config.privateKey, "private");

  const params: Record<string, string> = {
    app_id: input.config.appId,
    method: "alipay.trade.query",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    biz_content: JSON.stringify({ out_trade_no: input.orderNo }),
  };
  params.sign = signAlipay(params, privateKey);

  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });

  const raw = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { paid: false, raw, message: "支付宝查单响应解析失败" };
  }

  const tradeResponse = payload.alipay_trade_query_response as
    | {
        code?: string;
        msg?: string;
        sub_msg?: string;
        trade_status?: string;
        trade_no?: string;
        total_amount?: string;
      }
    | undefined;

  if (!tradeResponse) {
    return { paid: false, raw, message: "支付宝查单响应缺少 trade_query 节点" };
  }

  if (tradeResponse.code !== "10000") {
    return {
      paid: false,
      raw,
      message: tradeResponse.sub_msg || tradeResponse.msg || "支付宝查单失败",
      tradeStatus: tradeResponse.trade_status,
    };
  }

  const paid =
    tradeResponse.trade_status === "TRADE_SUCCESS" ||
    tradeResponse.trade_status === "TRADE_FINISHED";

  return {
    paid,
    tradeNo: tradeResponse.trade_no,
    totalAmount: tradeResponse.total_amount,
    tradeStatus: tradeResponse.trade_status,
    raw,
  };
}

function signWechatV2(params: Record<string, string>, apiKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort();
  const content = `${sorted.map((k) => `${k}=${params[k]}`).join("&")}&key=${apiKey}`;
  return crypto.createHash("md5").update(content, "utf8").digest("hex").toUpperCase();
}

function buildWechatXml(params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`)
    .join("");
  return `<xml>${body}</xml>`;
}

function parseWechatXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /<([a-zA-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    result[match[1]] = (match[2] ?? match[3] ?? "").trim();
  }
  return result;
}

export async function createWechatPayment(input: {
  config: WechatGatewayConfig;
  mode: WechatPayMode;
  orderNo: string;
  title: string;
  amount: number;
  notifyUrl: string;
  clientIp: string;
  returnUrl?: string;
}): Promise<PaymentLaunchResult> {
  const totalFee = Math.round(input.amount * 100);
  const nonceStr = crypto.randomBytes(16).toString("hex");

  const params: Record<string, string> = {
    appid: input.config.appId,
    mch_id: input.config.mchId,
    nonce_str: nonceStr,
    body: input.title.slice(0, 128),
    out_trade_no: input.orderNo,
    total_fee: String(totalFee),
    spbill_create_ip: input.clientIp || "127.0.0.1",
    notify_url: input.notifyUrl,
    trade_type: input.mode === "native" ? "NATIVE" : "MWEB",
  };

  if (input.mode === "mweb") {
    params.scene_info = JSON.stringify({
      payer_client_ip: input.clientIp || "127.0.0.1",
      h5_info: {
        type: "Wap",
        wap_url: input.returnUrl || input.notifyUrl.replace(/\/api\/payment\/notify\/wechat$/, ""),
        wap_name: "馒头助手",
      },
    });
  }

  params.sign = signWechatV2(params, input.config.apiKey);

  const response = await fetch("https://api.mch.weixin.qq.com/pay/unifiedorder", {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: buildWechatXml(params),
  });

  const text = await response.text();
  const data = parseWechatXml(text);

  if (data.return_code !== "SUCCESS" || data.result_code !== "SUCCESS") {
    const message = data.err_code_des || data.return_msg || "微信下单失败";
    throw new Error(message);
  }

  if (input.mode === "native") {
    if (!data.code_url) throw new Error("微信未返回二维码链接");
    return { type: "qrcode", codeUrl: data.code_url, mode: "wechat_native" };
  }

  if (!data.mweb_url) throw new Error("微信未返回 H5 支付链接");
  const redirectUrl = input.returnUrl
    ? `${data.mweb_url}&redirect_url=${encodeURIComponent(input.returnUrl)}`
    : data.mweb_url;
  return { type: "redirect", url: redirectUrl, mode: "wechat_h5" };
}