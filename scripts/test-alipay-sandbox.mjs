/**
 * 本地验证支付宝沙箱：签名 + 网关连通性（不经过浏览器）
 * 用法: node scripts/test-alipay-sandbox.mjs
 */
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function normalizePrivateKey(raw) {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  const pkcs1 = /^MIIE[op]/.test(body);
  const label = pkcs1 ? "RSA PRIVATE KEY" : "PRIVATE KEY";
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function signAlipay(params, privateKeyPem) {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort();
  const content = sorted.map((k) => `${k}=${params[k]}`).join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  return signer.sign(privateKeyPem, "base64");
}

const appId = process.env.ALIPAY_APP_ID;
const privateKeyRaw = process.env.ALIPAY_PRIVATE_KEY;
const gateway =
  process.env.ALIPAY_SANDBOX_GATEWAY ||
  "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

if (!appId || !privateKeyRaw) {
  console.error("缺少 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY，请先写入 .env.local");
  process.exit(1);
}

const privateKey = normalizePrivateKey(privateKeyRaw);
const orderNo = `TEST${Date.now()}`;
const bizContent = JSON.stringify({
  out_trade_no: orderNo,
  total_amount: "0.01",
  subject: "CloudMantou 沙箱测试",
  product_code: "FAST_INSTANT_TRADE_PAY",
});

const params = {
  app_id: appId,
  method: "alipay.trade.page.pay",
  format: "JSON",
  charset: "utf-8",
  sign_type: "RSA2",
  timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
  version: "1.0",
  notify_url: `${process.env.SITE_URL || "http://localhost:3000"}/api/payment/notify/alipay`,
  return_url: `${process.env.SITE_URL || "http://localhost:3000"}/payment/result?orderNo=${orderNo}`,
  biz_content: bizContent,
};

try {
  params.sign = signAlipay(params, privateKey);
  console.log("✓ 私钥签名成功");
} catch (err) {
  console.error("✗ 私钥签名失败:", err.message);
  process.exit(1);
}

const body = new URLSearchParams(params).toString();
const res = await fetch(gateway, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
  body,
  redirect: "manual",
});

console.log("网关:", gateway);
console.log("HTTP 状态:", res.status);
const text = await res.text();
if (res.status === 302 || text.includes("alipay") || text.includes("<form")) {
  console.log("✓ 沙箱网关接受请求（可跳转收银台）");
} else if (text.includes("invalid-signature") || text.includes("验签")) {
  console.error("✗ 支付宝返回验签失败，请检查应用私钥是否与沙箱应用匹配");
  console.log(text.slice(0, 500));
  process.exit(1);
} else {
  console.log("响应片段:", text.slice(0, 600));
}