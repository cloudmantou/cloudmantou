export type RedeemableCardStatus = "ACTIVE" | "USED" | "EXPIRED" | "DISABLED";

export type RedeemableCard = {
  id: string;
  cardNo: string;
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

export function redeemCard(
  cards: RedeemableCard[],
  input: { cardNo: string; cardSecret: string; userId: string },
  now = new Date()
): RedeemSuccess | RedeemFailure {
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
