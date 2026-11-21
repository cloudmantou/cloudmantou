import type { CardStatus, CardType, Prisma } from "@prisma/client";

const CARD_TYPES = new Set(["VIP_DAYS", "PAID_ARTICLE", "BALANCE", "GENERIC"]);
const CARD_STATUSES = new Set(["ACTIVE", "USED", "EXPIRED", "DISABLED"]);

/**
 * 后台卡密列表与导出共用的筛选条件。
 * 每个条件独立放进 AND，避免“已售/已兑”的 OR 覆盖搜索的 OR，
 * 或 excludeType 覆盖 type。已关联订单的卡视为已售，不算“未售”。
 */
export function buildAdminCardWhere(searchParams: URLSearchParams): Prisma.CardWhereInput {
  const type = searchParams.get("type") || undefined;
  const excludeType = searchParams.get("excludeType") || undefined;
  const status = searchParams.get("status") || undefined;
  const packageId = searchParams.get("packageId") || undefined;
  const batchNo = searchParams.get("batchNo") || undefined;
  const search = searchParams.get("search")?.trim() || undefined;

  const and: Prisma.CardWhereInput[] = [];
  if (type && CARD_TYPES.has(type)) and.push({ type: type as CardType });
  if (excludeType && CARD_TYPES.has(excludeType)) {
    and.push({ type: { not: excludeType as CardType } });
  }
  if (packageId) and.push({ packageId });
  if (batchNo) and.push({ batchNo });
  if (search) and.push({ OR: [{ cardNo: { contains: search } }, { batchNo: { contains: search } }] });
  if (status === "ACTIVE") and.push({ status: "ACTIVE", orderId: null });
  else if (status === "USED") and.push({ OR: [{ status: "USED" }, { orderId: { not: null } }] });
  else if (status && CARD_STATUSES.has(status)) {
    and.push({ status: status as CardStatus });
  }

  return and.length > 0 ? { AND: and } : {};
}

/** 列表与导出展示的状态：已关联订单的卡显示为 SOLD。 */
export function displayCardStatus(card: { status: string; orderId: string | null }): string {
  return card.orderId ? "SOLD" : card.status;
}
