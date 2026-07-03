import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// ===== 支付宝签名验证 =====

export function verifyAlipaySign(
  params: Record<string, string>,
  alipayPublicKey: string
): boolean {
  try {
    const { sign, sign_type, ...rest } = params;
    if (!sign) return false;

    // 过滤空值，按 key 排序
    const filtered = Object.entries(rest).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null
    );
    filtered.sort(([a], [b]) => a.localeCompare(b));
    const signStr = filtered.map(([k, v]) => `${k}=${v}`).join("&");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signStr, "utf8");

    // 支付宝公钥格式
    const pemKey = alipayPublicKey.includes("-----BEGIN")
      ? alipayPublicKey
      : `-----BEGIN PUBLIC KEY-----\n${alipayPublicKey}\n-----END PUBLIC KEY-----`;

    return verify.verify(pemKey, sign, "base64");
  } catch (err) {
    console.error("[Alipay Sign Verify Error]", err);
    return false;
  }
}

// ===== 微信支付 v2 签名验证 (MD5) =====

export function verifyWechatSign(
  body: Record<string, any>,
  apiKey: string
): boolean {
  try {
    const { sign, ...rest } = body;
    if (!sign) return false;

    const filtered = Object.entries(rest).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    );
    filtered.sort(([a], [b]) => a.localeCompare(b));
    const signStr =
      filtered.map(([k, v]) => `${k}=${v}`).join("&") + `&key=${apiKey}`;

    const expected = crypto
      .createHash("md5")
      .update(signStr, "utf8")
      .digest("hex")
      .toUpperCase();

    return sign === expected;
  } catch (err) {
    console.error("[Wechat Sign Verify Error]", err);
    return false;
  }
}

// ===== 微信支付 v3 签名验证 (SHA256-RSA2048) =====

export type WechatV3VerifyOptions = {
  expectedSerial?: string;
  maxSkewSec?: number;
};

export function verifyWechatV3Sign(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  serial: string,
  wechatPublicKey: string,
  options: WechatV3VerifyOptions = {}
): boolean {
  try {
    if (!timestamp || !nonce || !signature || !serial) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;

    const maxSkew = options.maxSkewSec ?? 300;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > maxSkew) {
      console.warn("[WechatV3] Timestamp outside replay window");
      return false;
    }

    if (options.expectedSerial && serial !== options.expectedSerial) {
      console.warn("[WechatV3] Platform certificate serial mismatch");
      return false;
    }

    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(message, "utf8");

    const pemKey = wechatPublicKey.includes("-----BEGIN")
      ? wechatPublicKey
      : `-----BEGIN PUBLIC KEY-----\n${wechatPublicKey}\n-----END PUBLIC KEY-----`;

    return verify.verify(pemKey, signature, "base64");
  } catch (err) {
    console.error("[WechatV3 Sign Verify Error]", err);
    return false;
  }
}

// ===== 金额校验 =====

export function verifyAmount(
  orderAmount: Decimal,
  paidAmountStr: string
): boolean {
  const orderCents = Math.round(Number(orderAmount) * 100);
  const paidNum = parseFloat(paidAmountStr);
  if (isNaN(paidNum)) return false;
  const paidCents = Math.round(paidNum * 100);
  return orderCents === paidCents;
}

// ===== 权益发放（统一逻辑） =====

/**
 * 计算 VIP 续费后的新到期时间
 * 如果当前 VIP 尚未过期，从现有到期时间开始续期；否则从当前时间开始
 */
function calculateVipExpiry(
  currentVipExpireAt: Date | null,
  now: Date,
  monthsToAdd: number
): Date {
  const baseDate =
    currentVipExpireAt && currentVipExpireAt > now
      ? new Date(currentVipExpireAt)
      : new Date(now);
  const expiresAt = new Date(baseDate);
  expiresAt.setMonth(expiresAt.getMonth() + monthsToAdd);
  return expiresAt;
}

export async function grantEntitlement(
  tx: any,
  order: { id: string; userId: string; productType: string; productId: string | null }
) {
  const now = new Date();

  switch (order.productType) {
    case "VIP_MONTH": {
      const user = await tx.user.findUnique({ where: { id: order.userId } });
      const expiresAt = calculateVipExpiry(user?.vipExpireAt ?? null, now, 1);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      // 同步更新用户 VIP 等级和到期时间
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 1 }, vipExpireAt: expiresAt },
      });
      break;
    }
    case "VIP_QUARTER": {
      const user = await tx.user.findUnique({ where: { id: order.userId } });
      const expiresAt = calculateVipExpiry(user?.vipExpireAt ?? null, now, 3);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 1 }, vipExpireAt: expiresAt },
      });
      break;
    }
    case "VIP_YEAR": {
      const user = await tx.user.findUnique({ where: { id: order.userId } });
      const expiresAt = calculateVipExpiry(user?.vipExpireAt ?? null, now, 12);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 2 }, vipExpireAt: expiresAt },
      });
      break;
    }
    case "PAID_POST":
      if (order.productId) {
        await tx.entitlement.create({
          data: {
            userId: order.userId,
            postId: order.productId,
            type: "PAID_POST",
            orderId: order.id,
            // 付费文章权益有效期 1 年，避免永久访问
            expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          },
        });
      }
      break;
    case "CARD_PACKAGE":
      // 卡密套餐交付由发卡流程单独处理
      break;
  }
}
