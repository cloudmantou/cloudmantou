import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const orderNo = process.argv[2];
if (!orderNo) {
  console.log("用法: node --env-file=.env scripts/lookup-order-card.mjs <订单号>");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { delivery: true, user: true },
  });

  if (!order) {
    console.log(`未找到订单: ${orderNo}`);
    process.exit(1);
  }

  console.log("================================");
  console.log("订单号:   ", order.orderNo);
  console.log("商品名称: ", order.title);
  console.log("购买用户: ", order.user.email);
  console.log("支付金额: ", `¥${order.amount}`);
  console.log("订单状态: ", order.status);

  if (!order.delivery) {
    console.log("发货状态:  未发货/非卡密商品");
  } else {
    const rawKey = process.env.POINT_CARD_KEY?.trim();
    let secret = "无法解密";
    if (rawKey) {
      const key = crypto.createHash("sha256").update(rawKey).digest();
      const enc = order.delivery.cardSecretEnc;
      if (enc.startsWith("points-v1:")) {
        const buf = Buffer.from(enc.slice("points-v1:".length), "base64");
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
        decipher.setAuthTag(buf.subarray(12, 28));
        secret = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
      }
    }
    console.log("卡号:     ", order.delivery.cardNo);
    console.log("卡密明文: ", secret);
    console.log("发货渠道: ", order.delivery.deliverySource);
  }
  console.log("================================");
} finally {
  await prisma.$disconnect();
}
