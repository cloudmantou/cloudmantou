import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { generateCardNo } from "@/lib/card-crypto";
import { encryptPointCardSecret, hashPointCardSecret, pointCardKey } from "@/lib/point-card-crypto";
import { decryptCardSecret } from "@/lib/card-secret-storage";
import { licenseDb, generateLicenseKey } from "@/lib/legacy-license-db";

export const MANTOU_SOURCE = "MANTOU_ADMIN";
type LegacyRow = { id: number; card_key: string; used: number; bound: bigint | number };
const unavailable = () => new ApiError("应用授权服务暂时不可用，请稍后重试", 50300, 503);

export async function usableLegacyIds(ids: number[], db?: PrismaClient): Promise<Set<number>> {
  const found = new Set<number>();
  if (!ids.length) return found;
  try {
    const source = db ?? licenseDb();
    for (let start = 0; start < ids.length; start += 200) {
      const rows = await source.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT c.id FROM cards c WHERE c.id IN (${Prisma.join(ids.slice(start, start + 200))}) AND c.used=0 AND NOT EXISTS(SELECT 1 FROM bindings b WHERE b.card_id=c.id)`);
      for (const row of rows) found.add(Number(row.id));
    }
  } catch { throw unavailable(); }
  return found;
}

export async function legacyCardUsable(card: { legacyCardId?: number | null; cardSecretEnc?: string | null }, db?: PrismaClient) {
  if (card.legacyCardId == null) return true;
  if (!card.cardSecretEnc) return false;
  const secret = decryptCardSecret(card.cardSecretEnc);
  try {
    const rows = await (db ?? licenseDb()).$queryRaw<LegacyRow[]>`SELECT c.id,c.card_key,c.used,(SELECT COUNT(*) FROM bindings b WHERE b.card_id=c.id) bound FROM cards c WHERE c.id=${card.legacyCardId}`;
    const row = rows[0];
    return Boolean(row && !row.used && !Number(row.bound) && row.card_key === secret);
  } catch { throw unavailable(); }
}

/** Provision first, then publish encrypted stock in the blog. Checkout/redemption
 * only reads the legacy database, so a blog transaction can fully roll back.
 * A failed blog import leaves valid, unassigned legacy cards for admin recovery;
 * never delete them on an ambiguous commit or after a network error. */
export async function provisionLegacyStock(input: { packageId: string; count: number; keys?: string[]; batchNo?: string; active?: boolean }, blog = prisma, legacy?: PrismaClient) {
  const pkg = await blog.cardPackage.findUnique({ where: { id: input.packageId } });
  if (!pkg || pkg.deliverySource !== MANTOU_SOURCE || pkg.cardType !== "GENERIC") throw new ApiError("请选择 Mantou Admin 应用授权商品", 42200, 422);
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 500) throw new ApiError("单次最多添加 500 张卡密", 42200, 422);
  const imported = input.keys?.map(key => key.trim());
  if (imported && (!imported.length || imported.length > 500 || imported.some(key => !key || key.length > 255))) throw new ApiError("请输入有效的应用授权卡密", 42200, 422);
  const keys = [...new Set(imported ?? Array.from({ length: input.count }, generateLicenseKey))];
  pointCardKey(); // Fail before provisioning if encrypted storage is not configured.
  let rows: LegacyRow[];
  try {
    const source = legacy ?? licenseDb();
    rows = await source.$transaction(async tx => {
      const result: LegacyRow[] = [];
      for (const key of keys) {
        if (!imported) await tx.$executeRaw`INSERT INTO cards (card_key,used) VALUES (${key},0)`;
        const matches = await tx.$queryRaw<LegacyRow[]>`SELECT c.id,c.card_key,c.used,(SELECT COUNT(*) FROM bindings b WHERE b.card_id=c.id) bound FROM cards c WHERE c.card_key=${key} FOR UPDATE`;
        const row = matches[0];
        if (!row || row.used || Number(row.bound)) throw new ApiError("导入卡密不存在、已使用或已绑定设备", 40900, 409);
        result.push(row);
      }
      return result;
    }, { timeout: 30000 });
  } catch (error) { if (error instanceof ApiError) throw error; throw unavailable(); }
  const already = await blog.card.findMany({ where: { legacyCardId: { in: rows.map(row => Number(row.id)) } }, select: { legacyCardId: true } });
  const assigned = new Set(already.map(row => row.legacyCardId));
  const uniqueRows = [...new Map(rows.map(row => [Number(row.id), row])).values()].filter(row => !assigned.has(Number(row.id)));
  const batchNo = input.batchNo || `MANTOU-${Date.now().toString(36)}`;
  const cards = [];
  for (const row of uniqueRows) cards.push({
    packageId: pkg.id, legacyCardId: Number(row.id), cardNo: generateCardNo({ prefix: "MA" }),
    cardSecretHash: await hashPointCardSecret(row.card_key), cardSecretEnc: encryptPointCardSecret(row.card_key),
    type: "GENERIC" as const, value: 1, batchNo, status: input.active === false ? "DISABLED" as const : "ACTIVE" as const,
  });
  try { if (cards.length) await blog.card.createMany({ data: cards }); }
  catch { throw new ApiError("授权卡密已保存在 Mantou Admin，但商城入库未完成；请从应用授权后台导入重试，不会扣除积分", 50300, 503); }
  return { batchNo, count: cards.length, cards: cards.map(card => ({ cardNo: card.cardNo, cardSecret: uniqueRows.find(row => Number(row.id) === card.legacyCardId)!.card_key })) };
}

export async function protectCommerceLicenseMutation(input: { action: string; id?: number | string; cardKey?: string }) {
  let legacyId: number | undefined;
  if (input.action === "card.delete") legacyId = Number(input.id);
  else if (input.action === "binding.add" && input.cardKey) {
    const rows = await licenseDb().$queryRaw<{ id: number }[]>`SELECT id FROM cards WHERE card_key=${input.cardKey}`;
    legacyId = rows[0]?.id;
  } else return;
  if (legacyId && await prisma.card.findUnique({ where: { legacyCardId: legacyId }, select: { id: true } })) throw new ApiError("此卡密已关联商城或积分库存，不能在此删除、重置或手动绑定；请在卡密库存和订单中管理", 40900, 409);
}
