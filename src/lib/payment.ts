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

export function verifyWechatV3Sign(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  serial: string,
  wechatPublicKey: string
): boolean {
  try {
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
  const orderNum = Number(orderAmount);
  const paidNum = parseFloat(paidAmountStr);
  if (isNaN(paidNum)) return false;
  // 支付宝金额单位是元，精确到分
  return Math.abs(orderNum - paidNum) < 0.01;
}

// ===== 权益发放（统一逻辑） =====

export async function grantEntitlement(
  tx: any,
  order: { id: string; userId: string; productType: string; productId: string | null }
) {
  const now = new Date();

  switch (order.productType) {
    case "VIP_MONTH": {
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      // 同步更新用户 VIP 等级
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 1 } },
      });
      break;
    }
    case "VIP_QUARTER": {
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 3);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 1 } },
      });
      break;
    }
    case "VIP_YEAR": {
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await tx.entitlement.create({
        data: { userId: order.userId, type: "VIP", orderId: order.id, expiresAt },
      });
      await tx.user.update({
        where: { id: order.userId },
        data: { vipLevel: { set: 2 } },
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
          },
        });
      }
      break;
    case "CARD_PACKAGE":
      // 卡密套餐交付由发卡流程单独处理
      break;
  }
}
