import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { deliverCardPackageOrder } from "@/lib/card-delivery";
import {
  assertOrderTransition,
  assertPaymentTransition,
  pairedStatusesForPaid,
} from "@/lib/payment-state";

/** 支付宝交易号：16–28 位字母数字 */
export const ALIPAY_TRADE_NO_RE = /^[0-9A-Za-z]{16,28}$/;

export function isValidAlipayTradeNo(tradeNo: string): boolean {
  return ALIPAY_TRADE_NO_RE.test(tradeNo.trim());
}

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

// ===== 微信支付 v3 回调解密 (AEAD_AES_256_GCM) =====

export function decryptWechatV3Resource(
  resource: {
    ciphertext: string;
    nonce: string;
    associated_data?: string;
  },
  apiV3Key: string
): Record<string, unknown> {
  const keyBytes = Buffer.from(apiV3Key, "utf8");
  if (keyBytes.length !== 32) {
    throw new Error("Invalid ApiV3Key: length must be 32 bytes");
  }

  const { ciphertext, nonce, associated_data = "" } = resource;
  const ciphertextBuffer = Buffer.from(ciphertext, "base64");
  if (ciphertextBuffer.length <= 16) {
    throw new Error("Invalid ciphertext");
  }

  const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16);
  const data = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes, Buffer.from(nonce, "utf8"));
  decipher.setAAD(Buffer.from(associated_data, "utf8"));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
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

type OrderForFinalize = {
  id: string;
  userId: string;
  productType: string;
  productId: string | null;
  status: string;
  amount: Decimal;
  payment: { id: string } | null;
};

export function canFinalizeOrder(status: string): boolean {
  return status === "PENDING";
}

/** 将支付宝订单标记为已支付并发放权益（异步通知与主动查单共用） */
export async function finalizeAlipayOrder(input: {
  order: OrderForFinalize;
  tradeNo: string;
  rawCallback: string;
}): Promise<boolean> {
  const { order, tradeNo, rawCallback } = input;

  if (order.status === "PAID") {
    return true;
  }

  if (!canFinalizeOrder(order.status)) {
    return false;
  }

  const { orderStatus, paymentStatus } = pairedStatusesForPaid();

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        status: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (!current || current.status === "PAID") {
      return;
    }

    assertOrderTransition(current.status, orderStatus);

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: current.status },
      data: { status: orderStatus, paidAt: new Date() },
    });

    if (updated.count === 0) {
      return;
    }

    const paymentData = {
      orderId: order.id,
      channel: "ALIPAY" as const,
      amount: order.amount,
      tradeNo,
      status: paymentStatus,
      rawCallback,
    };

    if (current.payment) {
      assertPaymentTransition(current.payment.status, paymentStatus);
      await tx.payment.update({
        where: { orderId: order.id },
        data: paymentData,
      });
    } else {
      await tx.payment.create({ data: paymentData });
    }

    await grantEntitlement(tx, order);
  });

  return true;
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
      await deliverCardPackageOrder(tx, order);
      break;
  }
}
