import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/guards";
import { canTransition, rewardStages, feedbackPolicySchema, defaultFeedbackPolicy } from "@/lib/feedback";
import type { z } from "zod";
import { feedbackCreateSchema, feedbackUpdateSchema } from "@/lib/feedback";
import { deliverCardPackageOrder } from "@/lib/card-delivery";
import { decryptCardSecret } from "@/lib/card-secret-storage";
import { randomUUID } from "crypto";

export const feedbackInclude = {
  user: { select: { id: true, nickname: true, username: true } },
  post: { select: { title: true, slug: true } },
  images: { select: { id: true }, orderBy: { createdAt: "asc" as const } },
  events: { select: { id: true, status: true, note: true, awardedPoints: true, createdAt: true }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
};
export async function feedbackPolicy(tx: Prisma.TransactionClient = prisma) {
  const row = await tx.siteSetting.findUnique({ where: { key: "feedback.pointsPolicy" } });
  try { const p = feedbackPolicySchema.safeParse(JSON.parse(row?.value || "null")); return p.success ? p.data : defaultFeedbackPolicy; }
  catch { return defaultFeedbackPolicy; }
}
export async function lockPointsUser(tx: Prisma.TransactionClient, userId: string) {
  const users = await tx.$queryRaw<{ id: string; points: number }[]>`SELECT id, points FROM users WHERE id=${userId} FOR UPDATE`;
  if (!users[0]) throw new ApiError("用户不存在", 40400, 404);
  return users[0];
}
export async function addPointEntry(tx: Prisma.TransactionClient, data: { userId: string; feedbackId?: string; key: string; delta: number; reason: string }) {
  const user = await lockPointsUser(tx, data.userId);
  if (await tx.pointEntry.findUnique({ where: { key: data.key } })) return 0;
  const balanceAfter = user.points + data.delta;
  if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0 || balanceAfter > 2147483647) throw new ApiError("积分余额不足或超出范围", 40900, 409);
  await tx.user.update({ where: { id: user.id }, data: { points: balanceAfter } });
  await tx.pointEntry.create({ data: { ...data, balanceAfter } });
  return data.delta;
}
export async function submitFeedback(postId: string, userId: string, data: z.infer<typeof feedbackCreateSchema>) {
  return prisma.$transaction(async tx => {
    await lockPointsUser(tx, userId);
    const post = await tx.post.findUnique({ where: { id: postId }, select: { status: true } });
    if (!post || post.status === "DRAFT") throw new ApiError("文章不存在", 40400, 404);
    const since = new Date(Date.now() - 86400000);
    if (await tx.articleFeedback.count({ where: { userId, createdAt: { gte: since } } }) >= 5) throw new ApiError("每天最多提交 5 条反馈", 42900, 429);
    const images = await tx.feedbackImage.findMany({ where: { id: { in: data.imageIds }, uploadedBy: userId, feedbackId: null, createdAt: { gte: since } } });
    if (images.length !== data.imageIds.length) throw new ApiError("截图不属于当前用户、已被使用或已过期", 42200, 422);
    const { imageIds, ...fields } = data;
    const item = await tx.articleFeedback.create({ data: { ...fields, postId, userId } });
    if (imageIds.length) await tx.feedbackImage.updateMany({ where: { id: { in: imageIds }, uploadedBy: userId, feedbackId: null }, data: { feedbackId: item.id } });
    await tx.feedbackEvent.create({ data: { feedbackId: item.id, actorId: userId, status: "SUBMITTED", note: "反馈已提交，等待开发者处理" } });
    return tx.articleFeedback.findUniqueOrThrow({ where: { id: item.id }, include: feedbackInclude });
  });
}
export async function updateFeedback(id: string, actorId: string, data: z.infer<typeof feedbackUpdateSchema>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM article_feedbacks WHERE id=${id} FOR UPDATE`;
    const item = await tx.articleFeedback.findUnique({ where: { id } });
    if (!item) throw new ApiError("反馈不存在", 40400, 404);
    if (!canTransition(item.status, data.status)) throw new ApiError("不能这样变更状态，请按处理进度操作", 40900, 409);
    if (data.published && !item.allowPublic) throw new ApiError("用户选择了私密反馈，不能公开", 40900, 409);
    if (data.status !== item.status && !data.note) throw new ApiError("请填写处理说明", 42200, 422);
    const policy = await feedbackPolicy(tx);
    let awarded = 0;
    for (const stage of rewardStages(data.status)) {
      // Zero-value entries also mark the milestone, preventing later policy changes from granting it again.
      awarded += await addPointEntry(tx, { userId: item.userId, feedbackId: id, key: `feedback:${id}:${stage}`, delta: policy[stage], reason: stage === "accepted" ? "反馈被采纳" : "反馈开发完成" });
    }
    const changed = data.status !== item.status || data.published !== item.published || data.resolvedVersion !== (item.resolvedVersion || "");
    await tx.articleFeedback.update({ where: { id }, data: { status: data.status, published: data.published, resolvedVersion: data.resolvedVersion || null } });
    if (changed || data.note || awarded) await tx.feedbackEvent.create({ data: { feedbackId: id, actorId, status: data.status, note: data.note || "开发者更新了反馈显示设置", awardedPoints: awarded } });
    return tx.articleFeedback.findUniqueOrThrow({ where: { id }, include: feedbackInclude });
  });
}
export async function redeemPointReward(userId: string, rewardId: string, requestKey: string) {
  return prisma.$transaction(async tx => {
    await lockPointsUser(tx, userId);
    const existing = await tx.pointRedemption.findUnique({ where: { userId_requestKey: { userId, requestKey } }, include: { order: { include: { delivery: true } } } });
    if (existing) {
      if (existing.rewardId !== rewardId) throw new ApiError("同一兑换请求不能更换商品", 40900, 409);
      return existing;
    }
    await tx.$queryRaw`SELECT id FROM point_rewards WHERE id=${rewardId} FOR UPDATE`;
    const reward = await tx.pointReward.findUnique({ where: { id: rewardId }, include: { package: true } });
    if (!reward?.enabled || !reward.package.enabled) throw new ApiError("该兑换商品尚未开放", 40900, 409);
    const id = randomUUID();
    await addPointEntry(tx, { userId, key: `redeem:${userId}:${requestKey}`, delta: -reward.cost, reason: `积分兑换：${reward.package.name}` });
    const order = await tx.order.create({ data: { userId, orderNo: `PTS${id.replaceAll("-", "")}`, productType: "CARD_PACKAGE", productId: reward.packageId, title: `积分兑换 · ${reward.package.name}`, amount: 0, status: "PAID", paidAt: new Date() } });
    // A delivery/decryption/stock failure rolls back the debit, order and card claim together.
    try { await deliverCardPackageOrder(tx, order); }
    catch (e) {
      const stockError = e instanceof Error && e.message.includes("库存");
      throw new ApiError(stockError ? "库存不足或已被领取，请稍后重试；未扣除积分" : "该商品暂时无法发卡，未扣除积分，请联系管理员", stockError ? 40900 : 50300, stockError ? 409 : 503);
    }
    return tx.pointRedemption.create({ data: { userId, rewardId, requestKey, orderId: order.id, cost: reward.cost }, include: { order: { include: { delivery: true } } } });
  }, { maxWait: 10000, timeout: 20000 });
}
export function pointReceipt(item: { id: string; cost: number; createdAt: Date; order: { delivery: { cardNo: string; cardSecretEnc: string } | null } }) {
  return { id: item.id, cost: item.cost, createdAt: item.createdAt, card: item.order.delivery ? { cardNo: item.order.delivery.cardNo, cardSecret: decryptCardSecret(item.order.delivery.cardSecretEnc) } : null };
}
export async function rewardStock(packageId: string) {
  return prisma.card.count({ where: { packageId, status: "ACTIVE", orderId: null, cardSecretEnc: { not: null }, OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] } });
}
export async function listPointRewards(admin = false) {
  const rows = await prisma.pointReward.findMany({ where: admin ? {} : { enabled: true, package: { enabled: true } }, include: { package: true }, orderBy: { createdAt: "desc" } });
  return Promise.all(rows.map(async row => ({ id: row.id, cost: row.cost, enabled: row.enabled, name: row.package.name, description: row.package.description, note: row.package.redemptionNote, type: row.package.cardType, value: row.package.cardValue, stock: await rewardStock(row.packageId) })));
}
export function feedbackPage(req: { nextUrl: URL }) {
  const raw = Number(req.nextUrl.searchParams.get("page") || 1);
  return Number.isSafeInteger(raw) ? Math.min(10000, Math.max(1, raw)) : 1;
}
export function feedbackError(error: unknown) {
  if (error instanceof ApiError) return { message: error.message, code: error.code, status: error.status };
  if (error instanceof SyntaxError) return { message: "请求格式不正确", code: 42200, status: 422 };
  console.error("[Feedback]", error instanceof Error ? error.name : "unknown");
  return { message: "操作失败，请稍后重试；积分和库存不会在失败时扣除", code: 50000, status: 500 };
}
