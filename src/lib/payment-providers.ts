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

const PAYMENT_PROVIDER_TIMEOUT_MS = 12_000;

function paymentProviderSignal(): AbortSignal {
  return AbortSignal.timeout(PAYMENT_PROVIDER_TIMEOUT_MS);
}

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

function buildAlipayForm(
  gatewayUrl: string,
  params: Record<string, string>,
  scriptNonce: string
): string {
  // Alipay pageExecute expects signed common parameters (including charset and
  // sign) in the gateway query string. Only biz_content belongs in the POST
  // body. Keeping every parameter as a hidden input makes the gateway reject
  // the request with invalid-signature before the payment page is rendered.
  const { biz_content: bizContent = "", ...commonParams } = params;
  const separator = gatewayUrl.includes("?") ? "&" : "?";
  const actionUrl = `${gatewayUrl}${separator}${new URLSearchParams(commonParams).toString()}`;
  const bizContentInput = `<input type="hidden" name="biz_content" value="${escapeHtml(bizContent)}" />`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>跳转支付宝</title></head><body><form id="alipay" method="post" action="${escapeHtml(actionUrl)}">${bizContentInput}</form><script nonce="${escapeHtml(scriptNonce)}">document.getElementById('alipay').submit();</script></body></html>`;
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
  scriptNonce: string;
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

  const html = buildAlipayForm(gatewayUrl, params, input.scriptNonce);
  return { type: "form", html, mode: input.mode === "page" ? "alipay_pc" : "alipay_h5" };
}

export type AlipayTradeQueryResult = {
  paid: boolean;
  outTradeNo?: string;
  tradeNo?: string;
  totalAmount?: string;
  tradeStatus?: string;
  raw: string;
  message?: string;
};

function extractJsonObject(raw: string, key: string): string | null {
  const marker = `"${key}"`;
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) return null;
  if (raw.indexOf(marker, markerIndex + marker.length) >= 0) return null;
  const colonIndex = raw.indexOf(":", markerIndex + marker.length);
  const objectStart = raw.indexOf("{", colonIndex + 1);
  if (colonIndex < 0 || objectStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(objectStart, index + 1);
    }
  }
  return null;
}

function verifyAlipayResponseSign(
  signContent: string,
  payload: Record<string, unknown>,
  publicKey: string
): boolean {
  const signature = typeof payload.sign === "string" ? payload.sign : "";
  if (!signature || !signContent) return false;
  try {
    const key = isPemEncoded(publicKey) ? publicKey : normalizePem(publicKey, "public");
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signContent, "utf8");
    return verifier.verify(key, signature, "base64");
  } catch {
    return false;
  }
}

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
    signal: paymentProviderSignal(),
  });

  const raw = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { paid: false, raw, message: "支付宝查单响应解析失败" };
  }

  // Alipay signs the exact raw `*_response` JSON node, not a re-serialized object.
  const signContent = extractJsonObject(raw, "alipay_trade_query_response");
  if (!signContent) {
    return { paid: false, raw, message: "支付宝查单响应节点缺失或重复" };
  }
  if (!verifyAlipayResponseSign(
    signContent,
    payload,
    input.config.publicKey
  )) {
    return { paid: false, raw, message: "支付宝查单响应签名无效" };
  }

  let tradeResponse: {
    code?: string;
    msg?: string;
    sub_msg?: string;
    trade_status?: string;
    out_trade_no?: string;
    trade_no?: string;
    total_amount?: string;
  };
  try {
    tradeResponse = JSON.parse(signContent) as typeof tradeResponse;
  } catch {
    return { paid: false, raw, message: "支付宝查单响应解析失败" };
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

  if (paid && tradeResponse.out_trade_no !== input.orderNo) {
    return {
      paid: false,
      outTradeNo: tradeResponse.out_trade_no,
      tradeStatus: tradeResponse.trade_status,
      raw,
      message: "支付宝查单响应订单不匹配",
    };
  }
  if (paid && (!tradeResponse.trade_no || !tradeResponse.total_amount)) {
    return {
      paid: false,
      outTradeNo: tradeResponse.out_trade_no,
      tradeStatus: tradeResponse.trade_status,
      raw,
      message: "支付宝查单响应缺少交易号或金额",
    };
  }

  return {
    paid,
    outTradeNo: tradeResponse.out_trade_no,
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
    .map(([k, v]) => `<${k}><![CDATA[${v.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></${k}>`)
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

function verifyWechatQuerySign(data: Record<string, string>, apiKey: string): boolean {
  const signature = data.sign?.trim().toUpperCase();
  if (!signature) return false;
  const expected = signWechatV2(data, apiKey);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export type WechatTradeQueryResult = {
  paid: boolean;
  transactionId?: string;
  totalFee?: number;
  tradeState?: string;
  raw: string;
  message?: string;
};

/** WeChat Pay v2 active order query used when the asynchronous callback is delayed. */
export async function queryWechatTrade(input: {
  config: WechatGatewayConfig;
  orderNo: string;
}): Promise<WechatTradeQueryResult> {
  const params: Record<string, string> = {
    appid: input.config.appId,
    mch_id: input.config.mchId,
    nonce_str: crypto.randomBytes(16).toString("hex"),
    out_trade_no: input.orderNo,
  };
  params.sign = signWechatV2(params, input.config.apiKey);

  const response = await fetch("https://api.mch.weixin.qq.com/pay/orderquery", {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: buildWechatXml(params),
    signal: paymentProviderSignal(),
  });
  const raw = await response.text();
  const data = parseWechatXml(raw);

  if (data.return_code !== "SUCCESS" || data.result_code !== "SUCCESS") {
    return {
      paid: false,
      raw,
      tradeState: data.trade_state,
      message: data.err_code_des || data.return_msg || "微信查单失败",
    };
  }
  if (!verifyWechatQuerySign(data, input.config.apiKey)) {
    return { paid: false, raw, message: "微信查单响应签名无效" };
  }
  if (!data.nonce_str) {
    return { paid: false, raw, message: "微信查单响应缺少随机串" };
  }
  if (
    data.appid !== input.config.appId ||
    data.mch_id !== input.config.mchId ||
    data.out_trade_no !== input.orderNo
  ) {
    return { paid: false, raw, message: "微信查单响应订单或商户不匹配" };
  }

  const totalFee = Number.parseInt(data.total_fee || "", 10);
  return {
    paid: data.trade_state === "SUCCESS",
    transactionId: data.transaction_id || undefined,
    totalFee: Number.isFinite(totalFee) ? totalFee : undefined,
    tradeState: data.trade_state,
    raw,
  };
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
    signal: paymentProviderSignal(),
  });

  const text = await response.text();
  const data = parseWechatXml(text);

  if (data.return_code !== "SUCCESS" || data.result_code !== "SUCCESS") {
    const message = data.err_code_des || data.return_msg || "微信下单失败";
    throw new Error(message);
  }
  if (!verifyWechatQuerySign(data, input.config.apiKey)) {
    throw new Error("微信下单响应签名无效");
  }
  if (!data.nonce_str) {
    throw new Error("微信下单响应缺少随机串");
  }
  if (data.appid !== input.config.appId || data.mch_id !== input.config.mchId) {
    throw new Error("微信下单响应商户不匹配");
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
