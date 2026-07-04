import type { CardPackage, CardType } from "@prisma/client";
import type { Accent, Product } from "@/types";

export type CardPackageInput = {
  slug: string;
  name: string;
  description: string;
  intro?: string | null;
  highlights?: string[];
  usageSteps?: string[];
  cardType: CardType;
  cardValue: number;
  price: number;
  badge?: string;
  accent?: string;
  cover?: string | null;
  enabled?: boolean;
  published?: boolean;
  sortOrder?: number;
};

export const DEFAULT_CARD_PACKAGE_TEMPLATES: CardPackageInput[] = [
  {
    slug: "vip-30",
    name: "VIP 30 天卡密",
    description: "一次性卡密，兑换后自动延长 30 天会员权益。",
    intro:
      "面向不方便在线支付、或需要通过社群/代理分发的场景。每张卡密绑定固定权益时长，兑换成功后立即写入账户。\n\n适合个人站长做团购、抽奖、合作推广；后台可按批次生成、导出 CSV，并追踪使用状态。",
    highlights: [
      "兑换即开通，无需等待人工审核",
      "支持未过期会员叠加续期",
      "批次号可追溯，防止重复发放",
      "库存实时同步，低库存自动提醒",
    ],
    usageSteps: [
      "购买后在订单页或邮件中获取卡号与卡密",
      "进入「个人中心 → 卡密兑换」填写信息",
      "提交后系统自动验签并发放 VIP 权益",
      "刷新页面即可阅读会员文章与下载附件",
    ],
    cardType: "VIP_DAYS",
    cardValue: 30,
    price: 25,
    badge: "HOT",
    accent: "gold",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.32), rgba(232,185,100,0.06)), url('https://images.unsplash.com/photo-1556740758-90de374c12bac?auto=format&fit=crop&w=800&q=80')",
    sortOrder: 10,
  },
  {
    slug: "vip-90",
    name: "VIP 90 天卡密",
    description: "季度卡密包，适合中期活动或渠道分销。",
    intro:
      "比月卡更优惠的季度权益包，适合训练营、社群打卡营等中期活动。兑换逻辑与月卡一致，库存按 VIP 天数池统一管理。",
    highlights: ["90 天会员时长", "适合季度活动发售", "支持批次备注与导出"],
    usageSteps: ["获取卡号卡密", "登录后在个人中心兑换", "兑换成功即可阅读会员内容"],
    cardType: "VIP_DAYS",
    cardValue: 90,
    price: 69,
    badge: "SAVE",
    accent: "teal",
    cover:
      "linear-gradient(135deg, rgba(77,217,182,0.28), rgba(77,217,182,0.05)), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80')",
    sortOrder: 20,
  },
  {
    slug: "paid-article-card",
    name: "付费文章解锁卡",
    description: "兑换后解锁一篇指定付费文章，适合单篇分销。",
    intro:
      "当你只想售卖某一门课程式长文、源码解读或付费专栏中的单篇内容时，用这张卡密比整站会员更精准。\n\n卡密类型为 PAID_ARTICLE，兑换后与订单购买享有相同阅读权限，默认有效期 1 年。",
    highlights: ["按篇售卖，转化路径更短", "适合社群福利发放", "支持导出未使用卡密做二次分发"],
    usageSteps: [
      "确认卡密对应的文章标题与价格",
      "登录后在卡密兑换页输入卡号卡密",
      "系统校验通过后解锁该篇文章全文",
    ],
    cardType: "PAID_ARTICLE",
    cardValue: 1,
    price: 8,
    badge: "NEW",
    accent: "blue",
    cover:
      "linear-gradient(135deg, rgba(107,154,255,0.3), rgba(107,154,255,0.05)), url('https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80')",
    sortOrder: 30,
  },
  {
    slug: "external-generic",
    name: "外部权益卡密",
    description: "兑换成功即完成核销，不自动解锁本站文章或会员。",
    intro:
      "适用于第三方平台、代理渠道或站外服务的卡密分发。用户兑换后仅标记卡密已使用，并展示你配置的兑换说明，不会写入本站 VIP 或文章券。\n\n可在商品管理中自定义 redemptionNote，生成卡密时也可单独填写备注。",
    highlights: ["不绑定本站文章解锁", "适合站外/代理发卡", "支持自定义兑换说明"],
    usageSteps: [
      "用户登录会员中心",
      "输入卡号与卡密完成兑换",
      "按兑换说明前往对应服务使用权益",
    ],
    cardType: "GENERIC",
    cardValue: 1,
    price: 1,
    badge: "EXT",
    accent: "rose",
    sortOrder: 35,
  },
  {
    slug: "balance-100",
    name: "余额充值卡",
    description: "兑换后账户余额增加，可用于后续站内消费。",
    intro: "适合需要预充值、活动返现或代理结算的场景。兑换后余额立即入账，可用于后续站内订单抵扣（功能持续完善中）。",
    highlights: ["即时到账", "适合代理结算", "可与其他权益卡组合发售"],
    usageSteps: ["登录个人中心", "输入卡号卡密完成兑换", "在账户余额中查看入账记录"],
    cardType: "BALANCE",
    cardValue: 100,
    price: 100,
    badge: "NEW",
    accent: "orange",
    sortOrder: 40,
  },
];

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function serializeCardPackageLists(input: {
  highlights?: string[];
  usageSteps?: string[];
}) {
  return {
    highlights: input.highlights?.length ? input.highlights : undefined,
    usageSteps: input.usageSteps?.length ? input.usageSteps : undefined,
  };
}

/** 商品展示价：0.01 等小金额保留有效小数，整数不显示 .00 */
export function formatProductPrice(price: number | string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return "¥0";
  const fixed = n.toFixed(2).replace(/\.?0+$/, "");
  return `¥${fixed}`;
}

export function cardPackageToProduct(
  pkg: CardPackage,
  stock: number
): Product {
  return {
    id: pkg.id,
    category: "card",
    name: pkg.name,
    description: pkg.description,
    intro: pkg.intro || undefined,
    highlights: parseStringArray(pkg.highlights),
    usageSteps: parseStringArray(pkg.usageSteps),
    price: formatProductPrice(Number(pkg.price)),
    stock,
    badge: pkg.badge,
    accent: (pkg.accent as Accent) || "gold",
    cover:
      pkg.cover ||
      "linear-gradient(135deg, rgba(232,185,100,0.22), rgba(77,217,182,0.12))",
    productType: "CARD_PACKAGE",
  };
}

/** 可售库存：绑定商品、未售出（无订单）、状态为 ACTIVE */
export function availableCardStockWhere(packageId: string) {
  return {
    packageId,
    status: "ACTIVE" as const,
    orderId: null,
  };
}

export function formatCardValue(cardType: CardType | string, cardValue: number) {
  switch (cardType) {
    case "VIP_DAYS":
      return `${cardValue} 天`;
    case "PAID_ARTICLE":
      return `${cardValue} 篇`;
    case "BALANCE":
      return `¥${cardValue}`;
    case "GENERIC":
      return "通用";
    default:
      return String(cardValue);
  }
}

export async function countActiveCardStock(
  prisma: {
    card: {
      count: (args: {
        where: { packageId: string; status: "ACTIVE"; orderId: null };
      }) => Promise<number>;
    };
  },
  packageId: string
) {
  return prisma.card.count({
    where: availableCardStockWhere(packageId),
  });
}