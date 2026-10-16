import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAndAudit, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
import { generateCardNo, generateCardSecret } from "@/lib/card-crypto";
import { encryptPointCardSecret, hashPointCardSecret } from "@/lib/point-card-crypto";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), cost: z.number().int().min(1).max(1000000), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("stock"), count: z.number().int().min(1).max(30), importLines: z.array(z.string().trim().min(1).max(300)).max(30).optional() }).strict(),
]);
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; await requireAdminAndAudit(req, "points.reward.update", { targetId: id });
    const p = schema.safeParse(await feedbackJson(req)); if (!p.success) throw new ApiError(p.error.errors[0].message, 42200, 422);
    const reward = await prisma.pointReward.findUnique({ where: { id }, include: { package: true } }); if (!reward) throw new ApiError("兑换商品不存在", 40400, 404);
    if (p.data.action === "update") { await prisma.pointReward.update({ where: { id }, data: { cost: p.data.cost, enabled: p.data.enabled } }); return privateOk({ saved: true }); }
    const { count, importLines } = p.data;
    if (importLines && !importLines.length) throw new ApiError("请填写导入卡密", 42200, 422);
    if (reward.package.cardType === "GENERIC" && !importLines) throw new ApiError("通用或外部卡密须导入实际可用的卡号和卡密", 42200, 422);
    const cards = [];
    for (let i = 0; i < (importLines?.length ?? count); i++) {
      const line = importLines?.[i]; const split = line?.indexOf(",") ?? -1;
      if (line && split < 1) throw new ApiError("导入格式为每行：卡号,卡密", 42200, 422);
      const cardNo = line ? line.slice(0, split).trim() : generateCardNo({ prefix: "PT" });
      const secret = line ? line.slice(split + 1).trim() : generateCardSecret();
      if (cardNo.length < 4 || cardNo.length > 64 || secret.length < 4 || secret.length > 128) throw new ApiError("卡号须为 4–64 字，卡密须为 4–128 字", 42200, 422);
      cards.push({ packageId: reward.packageId, cardNo, cardSecretHash: await hashPointCardSecret(secret), cardSecretEnc: encryptPointCardSecret(secret), type: reward.package.cardType, value: reward.package.cardValue, batchNo: `POINTS-${id}`, status: "ACTIVE" as const });
    }
    await prisma.card.createMany({ data: cards });
    return privateOk({ added: cards.length });
  } catch (e) { return feedbackFail(e); }
}
