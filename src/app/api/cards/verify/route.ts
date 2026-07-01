import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { cardVerifySchema } from "@/lib/validators/card";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // 需要登录
  const session = await auth();
  if (!session?.user) {
    return fail("请先登录", 40100, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = cardVerifySchema.safeParse(body);

  if (!parsed.success) {
    return fail("卡号或卡密格式不正确", 40000, 400);
  }

  const { cardNo, cardSecret } = parsed.data;
  const userId = session.user.id;

  try {
    // 查找卡密
    const card = await prisma.card.findFirst({
      where: {
        cardNo,
        cardSecret,
      },
    });

    if (!card) {
      return fail("卡密不存在或卡号卡密不匹配", 40400, 404);
    }

    if (card.status !== "ACTIVE") {
      const statusMap: Record<string, string> = {
        USED: "该卡密已被使用",
        EXPIRED: "该卡密已过期",
        DISABLED: "该卡密已被禁用",
      };
      return fail(statusMap[card.status] || "卡密不可用", 42200, 422);
    }

    if (card.expireAt && card.expireAt < new Date()) {
      // 自动标记过期
      await prisma.card.update({
        where: { id: card.id },
        data: { status: "EXPIRED" },
      });
      return fail("该卡密已过期", 42200, 422);
    }

    // 事务：标记卡密已使用 + 执行对应业务逻辑
    const result = await prisma.$transaction(async (tx) => {
      // 标记卡密已使用
      await tx.card.update({
        where: { id: card.id },
        data: {
          status: "USED",
          usedBy: userId,
          usedAt: new Date(),
        },
      });

      // 根据卡密类型执行不同逻辑
      let benefit: { type: string; message: string } | null = null;

      if (card.type === "VIP_DAYS") {
        // 会员天数卡：延长 VIP
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("用户不存在");

        const now = new Date();
        const baseDate = user.vipExpireAt && user.vipExpireAt > now
          ? user.vipExpireAt
          : now;

        const newExpire = new Date(baseDate);
        newExpire.setDate(newExpire.getDate() + card.value);

        await tx.user.update({
          where: { id: userId },
          data: {
            vipLevel: Math.max(user.vipLevel, 1),
            vipExpireAt: newExpire,
          },
        });

        benefit = {
          type: "VIP",
          message: `会员已延长 ${card.value} 天，新到期时间：${newExpire.toLocaleDateString("zh-CN")}`,
        };
      } else if (card.type === "PAID_ARTICLE") {
        // 付费文章兑换卡：创建 Entitlement
        // value 在此类型中代表文章数量或金额，这里简化为余额
        benefit = {
          type: "PAID_ARTICLE",
          message: `已获得付费文章阅读额度，可前往文章页面使用`,
        };
      } else if (card.type === "BALANCE") {
        // 余额充值卡
        benefit = {
          type: "BALANCE",
          message: `已充值 ${(card.value / 100).toFixed(2)} 元`,
        };
      }

      return benefit;
    });

    return ok({
      cardType: card.type,
      value: card.value,
      benefit: result,
    });
  } catch (error) {
    console.error("[Card Verify Error]", error);
    return fail("卡密兑换失败，请稍后重试", 50000, 500);
  }
}
