import type { OfficialLocale } from "@/i18n/official";
import type { Product } from "@/types";

type ProductCopy = Pick<Product, "name" | "description" | "intro" | "highlights" | "usageSteps" | "badge">;
type CardIdentity = Pick<Product, "productSlug" | "cardType" | "cardValue">;

const EN_PRODUCT_COPY: Partial<Record<NonNullable<Product["productType"]>, Partial<ProductCopy>>> = {
  VIP_MONTH: {
    name: "Monthly membership",
    description: "Unlock members-only articles, downloads, and the member comment badge for one month.",
    intro: "A flexible monthly plan for readers who want to try the full member experience.",
    highlights: ["Members-only articles", "Download attachments", "Member comment badge"],
    badge: "POPULAR",
  },
  VIP_QUARTER: {
    name: "Quarterly membership",
    description: "Three months of membership benefits for ongoing reading and product updates.",
    badge: "VALUE",
  },
  VIP_YEAR: {
    name: "Annual membership",
    description: "A full year of membership benefits and continued access to new member columns.",
    intro: "Best for long-term readers who follow the build notes and product releases throughout the year.",
    highlights: ["One year of membership", "New member columns", "Priority product notes"],
    badge: "SAVE",
  },
  PAID_POST: {
    name: "Paid article",
    description: "One-time access to a selected premium article.",
    badge: "ARTICLE",
  },
};

const EN_CARD_PACKAGE_COPY: Record<string, Partial<ProductCopy>> = {
  "vip-30": {
    name: "30-day membership card",
    description: "Redeem once to add 30 days of membership to an account.",
    intro: "A flexible membership card for personal purchases, gifts, and community distribution.",
    highlights: ["Instant redemption", "Stacks with active membership", "Traceable delivery"],
    usageSteps: ["Complete payment", "Open account center", "Enter the card number and secret"],
    badge: "POPULAR",
  },
  "vip-90": {
    name: "90-day membership card",
    description: "Redeem once to add 90 days of membership to an account.",
    intro: "A better-value membership card for quarterly access and longer projects.",
    highlights: ["90 days of membership", "Instant redemption", "Traceable delivery"],
    usageSteps: ["Complete payment", "Open account center", "Enter the card number and secret"],
    badge: "VALUE",
  },
  "paid-article-card": {
    name: "Paid article access card",
    description: "Redeem the card to unlock one selected premium article.",
    usageSteps: ["Complete payment", "Open account center", "Redeem the card for article access"],
    badge: "ARTICLE",
  },
  "external-generic": {
    name: "External benefit card",
    description: "Redeem the card and follow the package instructions to use the external benefit.",
    usageSteps: ["Complete payment", "Redeem the card in account center", "Follow the delivery instructions"],
    badge: "EXTERNAL",
  },
  "balance-100": {
    name: "¥100 account balance card",
    description: "Redeem the card to add ¥100 to the account balance.",
    usageSteps: ["Complete payment", "Open account center", "Redeem the card and review the balance"],
    badge: "BALANCE",
  },
};

const CARD_USAGE_STEPS = ["Complete payment", "Open account center", "Enter the card number and secret"];

function humanizeSlug(slug: string | undefined): string {
  return slug?.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Custom";
}

function fallbackCardCopy(identity: CardIdentity): Partial<ProductCopy> {
  const value = Number.isFinite(identity.cardValue) ? Number(identity.cardValue) : 1;
  const packageLabel = humanizeSlug(identity.productSlug);
  switch (identity.cardType) {
    case "VIP_DAYS":
      return {
        name: `${value}-day membership card · ${packageLabel}`,
        description: `Redeem once to add ${value} days of membership to an account.`,
        usageSteps: CARD_USAGE_STEPS,
        badge: "MEMBERSHIP",
      };
    case "PAID_ARTICLE":
      return {
        name: `${value === 1 ? "Paid article access card" : `${value}-article access card`} · ${packageLabel}`,
        description: `Redeem once to unlock ${value} premium ${value === 1 ? "article" : "articles"}.`,
        usageSteps: CARD_USAGE_STEPS,
        badge: "ARTICLE",
      };
    case "BALANCE":
      return {
        name: `¥${value} account balance card · ${packageLabel}`,
        description: `Redeem once to add ¥${value} to the account balance.`,
        usageSteps: CARD_USAGE_STEPS,
        badge: "BALANCE",
      };
    default:
      return {
        name: `External benefit card · ${humanizeSlug(identity.productSlug)}`,
        description: "Redeem the card and follow the package instructions to use its benefit.",
        usageSteps: CARD_USAGE_STEPS,
        badge: "CARD",
      };
  }
}

function englishCardCopy(identity: CardIdentity): Partial<ProductCopy> {
  return (identity.productSlug && EN_CARD_PACKAGE_COPY[identity.productSlug]) || fallbackCardCopy(identity);
}

export function localizeEditorialProduct(product: Product, locale: OfficialLocale): Product {
  if (locale === "zh" || !product.productType) return product;
  const copy = product.productType === "CARD_PACKAGE" ? englishCardCopy(product) : EN_PRODUCT_COPY[product.productType];
  return copy ? { ...product, ...copy } : product;
}

export type EditorialOrderIdentity = {
  title: string;
  productType?: Product["productType"] | null;
  productId?: string | null;
  product?: Partial<Product> | null;
};

export function localizeEditorialOrderTitle(order: EditorialOrderIdentity, locale: OfficialLocale): string {
  if (locale === "zh" || !order.productType) return order.title;
  if (order.productType === "CARD_PACKAGE") {
    return englishCardCopy(order.product ?? {}).name || "Card package";
  }
  return EN_PRODUCT_COPY[order.productType]?.name || order.title;
}
