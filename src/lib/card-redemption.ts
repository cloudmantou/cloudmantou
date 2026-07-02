/**
 * @deprecated 此模块已被 `src/app/api/cards/verify/route.ts` 中的哈希验证流程取代。
 *
 * 安全警告：本模块使用明文卡密比较（`item.cardSecret === input.cardSecret`），
 * 仅保留用于测试和类型参考。**切勿在生产 API 中调用此模块。**
 * 生产环境卡密验证请使用 `hashCardSecret` / `verifyCardSecret` 进行哈希比对。
 *
 * @see src/lib/card-crypto.ts
 * @see src/app/api/cards/verify/route.ts
 */

export type RedeemableCardStatus = "ACTIVE" | "USED" | "EXPIRED" | "DISABLED";

export type RedeemableCard = {
  id: string;
  cardNo: string;
  /** 明文卡密 — 仅用于测试，生产环境数据库只存哈希值 */
  cardSecret: string;
  type: "VIP_DAYS" | "PAID_ARTICLE" | "BALANCE";
  value: number;
  status: RedeemableCardStatus;
  usedBy?: string;
  usedAt?: string;
  expireAt?: string;
};

export type RedeemSuccess = {
  ok: true;
  card: RedeemableCard;
  cards: RedeemableCard[];
};

export type RedeemFailure = {
  ok: false;
  reason: "NOT_FOUND" | "INVALID_STATUS" | "EXPIRED";
};

/**
 * @deprecated 请使用 `src/app/api/cards/verify/route.ts` 中的哈希验证流程。
 * 此函数仅用于单元测试，使用明文比较，不应用于生产环境。
 */
export function redeemCard(
  cards: RedeemableCard[],
  input: { cardNo: string; cardSecret: string; userId: string },
  now = new Date()
): RedeemSuccess | RedeemFailure {
  // 注意：此处使用明文比较，仅为测试用途。生产 API 使用 cardSecretHash 哈希比对。
  const card = cards.find(
    (item) => item.cardNo === input.cardNo && item.cardSecret === input.cardSecret
  );

  if (!card) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (card.status !== "ACTIVE") {
    return { ok: false, reason: "INVALID_STATUS" };
  }

  if (card.expireAt && new Date(card.expireAt).getTime() < now.getTime()) {
    return { ok: false, reason: "EXPIRED" };
  }

  const redeemedCard: RedeemableCard = {
    ...card,
    status: "USED",
    usedBy: input.userId,
    usedAt: now.toISOString()
  };

  return {
    ok: true,
    card: redeemedCard,
    cards: cards.map((item) => (item.id === card.id ? redeemedCard : item))
  };
}
