import { decryptCardSecret } from "@/lib/card-secret-storage";

export type OrderFulfillment = {
  kind: "none" | "card" | "membership" | "article";
  message: string | null;
  card: { cardNo: string; cardSecret: string } | null;
};

type FulfillmentOrder = {
  productType: string;
  status: string;
  delivery: {
    cardNo: string;
    cardSecretEnc: string;
  } | null;
};

/** Build the owner-only fulfillment receipt shared by order history and payment status. */
export function buildOrderFulfillment(order: FulfillmentOrder): OrderFulfillment {
  if (order.status !== "PAID") {
    return { kind: "none", message: null, card: null };
  }

  if (order.productType === "CARD_PACKAGE") {
    if (order.delivery) {
      return {
        kind: "card",
        message: "卡密已发放，请妥善保存",
        card: {
          cardNo: order.delivery.cardNo,
          cardSecret: decryptCardSecret(order.delivery.cardSecretEnc),
        },
      };
    }
    return { kind: "card", message: "卡密发放中，请稍后刷新", card: null };
  }

  if (["VIP_MONTH", "VIP_QUARTER", "VIP_YEAR"].includes(order.productType)) {
    return {
      kind: "membership",
      message: "会员已自动开通，无需卡密",
      card: null,
    };
  }

  if (order.productType === "PAID_POST") {
    return {
      kind: "article",
      message: "付费文章已解锁",
      card: null,
    };
  }

  return { kind: "none", message: null, card: null };
}
