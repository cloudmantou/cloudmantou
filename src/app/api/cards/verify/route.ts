import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { cardVerifySchema } from "@/lib/validators/card";
import { auth } from "@/lib/auth";
import { verifyCardSecret, hashCardSecret, isLegacyHash } from "@/lib/card-crypto";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return fail("请先登录", 40100, 401);
  }

  // 速率限制：每用户每 15 分钟最多 10 次卡密验证
  const limited = checkRateLimit(req, RATE_LIMITS.CARD_VERIFY, session.user.id);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = cardVerifySchema.safeParse(body);

  if (!parsed.success) {
    return fail("卡号或卡密格式不正确", 40000, 400);
  }

  const { cardNo, cardSecret } = parsed.data;
  const userId = session.user.id;

  try {
    // bcrypt 哈希不可逆，不能在 DB 查询中直接比对。
    // 先按 cardNo 查出卡密记录，再用 verifyCardSecret 比对哈希。
    const card = await prisma.card.findFirst({
      where: { cardNo },
    });

    if (!card) {
      return fail("卡密不存在或卡号卡密不匹配", 40400, 404);
    }

    // 使用 bcrypt（新卡密）或 SHA-256（存量旧卡密）验证
    const isValid = await verifyCardSecret(cardSecret, card.cardSecretHash);
    if (!isValid) {
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
      await prisma.card.update({
        where: { id: card.id },
        data: { status: "EXPIRED" },
      });
      return fail("该卡密已过期", 42200, 422);
    }

    // ===== 原子兑换：条件更新 + 检查 affected count =====
    const result = await prisma.$transaction(async (tx) => {
      // 原子抢占：只有 status=ACTIVE 的卡才能被标记为 USED
      const updateResult = await tx.card.updateMany({
        where: {
          id: card.id,
          status: "ACTIVE",
        },
        data: {
          status: "USED",
          usedBy: userId,
          usedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        // 并发竞争失败：其他请求已抢占此卡
        throw new Error("CONCURRENT_CONFLICT");
      }

      // 旧 SHA-256 哈希升级为 bcrypt（惰性迁移）
      if (isLegacyHash(card.cardSecretHash)) {
        const newHash = await hashCardSecret(cardSecret);
        await tx.card.update({
          where: { id: card.id },
          data: { cardSecretHash: newHash },
        });
      }

      // 根据卡密类型执行对应业务逻辑
      let benefit: { type: string; message: string } | null = null;

      if (card.type === "VIP_DAYS") {
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
        const credits = Math.max(1, card.value);
        for (let i = 0; i < credits; i += 1) {
          await tx.entitlement.create({
            data: {
              userId,
              type: "PAID_POST",
            },
          });
        }

        benefit = {
          type: "PAID_ARTICLE",
          message: `已获得付费文章阅读额度 ${credits} 篇（首次阅读时自动绑定文章）`,
        };
      } else if (card.type === "BALANCE") {
        // 余额充值：更新用户余额
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { increment: card.value },
          },
        });

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
  } catch (error: any) {
    if (error?.message === "CONCURRENT_CONFLICT") {
      return fail("该卡密正在被其他用户兑换，请稍后重试", 40900, 409);
    }
    console.error("[Card Verify Error]", error);
    return fail("卡密兑换失败，请稍后重试", 50000, 500);
  }
}
