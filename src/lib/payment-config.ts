import { prisma } from "@/lib/prisma";
import { decryptGatewaySecrets } from "@/lib/secret-crypto";

export type AlipayGatewayConfig = {
  enabled: boolean;
  env: "sandbox" | "production";
  appId: string;
  privateKey: string;
  publicKey: string;
  sellerId?: string;
};

export type WechatGatewayConfig = {
  enabled: boolean;
  appId: string;
  mchId: string;
  /** V2 商户 API 密钥：统一下单签名、V2 回调验签 */
  apiKey: string;
  /** V3 API 密钥：V3 回调报文解密（32 字节明文） */
  apiV3Key?: string;
  publicKey?: string;
  platformSerial?: string;
};

export type PaymentRuntimeConfig = {
  siteUrl: string;
  testMode: boolean;
  alipay: AlipayGatewayConfig | null;
  wechat: WechatGatewayConfig | null;
};

const ALIPAY_GATEWAYS = {
  sandbox: "https://openapi.alipaydev.com/gateway.do",
  production: "https://openapi.alipay.com/gateway.do",
} as const;

async function readGatewaySettings(): Promise<Record<string, Record<string, unknown>>> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "paymentGateways" } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as Record<string, Record<string, unknown>>;
    return decryptGatewaySecrets(parsed);
  } catch {
    return {};
  }
}

function normalizePem(value: string, type: "private" | "public"): string {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  if (type === "private") {
    return `-----BEGIN RSA PRIVATE KEY-----\n${lines}\n-----END RSA PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

export function getAlipayGatewayUrl(env: "sandbox" | "production") {
  return ALIPAY_GATEWAYS[env];
}

export function normalizeAlipayEnv(raw: unknown): "sandbox" | "production" {
  const value = String(raw || "").trim();
  if (value === "sandbox" || value === "沙箱环境") return "sandbox";
  return "production";
}

export async function getPaymentRuntimeConfig(): Promise<PaymentRuntimeConfig> {
  const [gateways, testModeRow, siteUrlRow] = await Promise.all([
    readGatewaySettings(),
    prisma.siteSetting.findUnique({ where: { key: "paymentTestMode" } }),
    prisma.siteSetting.findUnique({ where: { key: "siteUrl" } }),
  ]);

  const siteUrl = (
    siteUrlRow?.value ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const testMode = testModeRow?.value === "true";

  const alipayDb = (gateways.alipay || {}) as Record<string, string | boolean>;
  const wechatDb = (gateways.wechat || {}) as Record<string, string | boolean>;

  const alipayEnabled = alipayDb.enabled !== false;
  const wechatEnabled = wechatDb.enabled !== false;

  const alipayAppId = String(alipayDb.appId || process.env.ALIPAY_APP_ID || "").trim();
  const alipayPrivateKey = String(alipayDb.privateKey || process.env.ALIPAY_PRIVATE_KEY || "").trim();
  const alipayPublicKey = String(alipayDb.publicKey || process.env.ALIPAY_PUBLIC_KEY || "").trim();

  const wechatAppId = String(wechatDb.appId || process.env.WECHAT_APP_ID || "").trim();
  const wechatMchId = String(wechatDb.mchId || process.env.WECHAT_MCH_ID || "").trim();
  const wechatApiKeyV2 = String(wechatDb.apiKey || process.env.WECHAT_API_KEY || "").trim();
  const wechatApiV3Key = String(
    wechatDb.apiV3Key || process.env.WECHAT_API_V3_KEY || ""
  ).trim();
  // 兼容旧配置：后台曾只填 apiV3Key，回退用于 V2 签名
  const wechatApiKey = wechatApiKeyV2 || wechatApiV3Key;
  const wechatPublicKey = String(
    wechatDb.publicKey || process.env.WECHAT_V3_PUBLIC_KEY || ""
  ).trim();
  const wechatPlatformSerial = String(
    wechatDb.platformSerial || process.env.WECHAT_V3_PLATFORM_SERIAL || ""
  ).trim();

  const alipay: AlipayGatewayConfig | null =
    alipayEnabled && alipayAppId && alipayPrivateKey && alipayPublicKey
      ? {
          enabled: true,
          env: normalizeAlipayEnv(alipayDb.env),
          appId: alipayAppId,
          privateKey: normalizePem(alipayPrivateKey, "private"),
          publicKey: normalizePem(alipayPublicKey, "public"),
          sellerId: String(alipayDb.sellerId || process.env.ALIPAY_SELLER_ID || "").trim() || undefined,
        }
      : null;

  const wechat: WechatGatewayConfig | null =
    wechatEnabled && wechatAppId && wechatMchId && wechatApiKey
      ? {
          enabled: true,
          appId: wechatAppId,
          mchId: wechatMchId,
          apiKey: wechatApiKey,
          apiV3Key: wechatApiV3Key || undefined,
          publicKey: wechatPublicKey || undefined,
          platformSerial: wechatPlatformSerial || undefined,
        }
      : null;

  return { siteUrl, testMode, alipay, wechat };
}