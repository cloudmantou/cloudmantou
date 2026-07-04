import { prisma } from "@/lib/prisma";
import { formatProductPrice } from "@/lib/card-packages";
import type { Product } from "@/types";

export type MembershipProductType = "VIP_MONTH" | "VIP_YEAR";

export type MembershipCatalogState = Record<
  MembershipProductType,
  { published: boolean; enabled: boolean }
>;

export type MembershipProductAdmin = {
  productType: MembershipProductType;
  id: string;
  name: string;
  description: string;
  intro: string;
  highlights: string[];
  price: number;
  priceLabel: string;
  badge: string;
  accent: Product["accent"];
  cover: string;
  published: boolean;
  enabled: boolean;
};

const SETTING_KEY = "membershipCatalog";

const DEFAULT_STATE: MembershipCatalogState = {
  VIP_MONTH: { published: true, enabled: true },
  VIP_YEAR: { published: true, enabled: true },
};

export const MEMBERSHIP_PRODUCT_DEFS: Record<
  MembershipProductType,
  Omit<MembershipProductAdmin, "published" | "enabled" | "priceLabel">
> = {
  VIP_MONTH: {
    productType: "VIP_MONTH",
    id: "vip-month",
    name: "月度会员",
    description: "解锁所有会员文章、下载附件和会员评论标识。",
    intro:
      "适合想先体验一个月会员内容的读者。开通后可阅读全站会员文章、显示会员标识，并下载文章附件。\n\n到期前可续费，未过期续费会从当前到期日顺延。",
    highlights: ["全站会员文章", "附件下载", "会员评论标识", "随时可续费"],
    price: 29,
    badge: "HOT",
    accent: "gold",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.28), rgba(232,185,100,0.04)), url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80')",
  },
  VIP_YEAR: {
    productType: "VIP_YEAR",
    id: "vip-year",
    name: "年度会员",
    description: "适合长期订阅，包含后续新增会员专栏。",
    intro:
      "为长期读者准备的优惠套餐。一次订阅全年有效，后续新增的会员专栏也会自动纳入权益范围。\n\n相比按月购买可节省约 40%，适合深度用户与团队学习账号。",
    highlights: ["全年会员权益", "新增专栏自动解锁", "性价比更高", "支持叠加续期"],
    price: 199,
    badge: "SAVE",
    accent: "teal",
    cover:
      "linear-gradient(135deg, rgba(77,217,182,0.26), rgba(77,217,182,0.04)), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80')",
  },
};

export const MEMBERSHIP_PRODUCT_TYPES = Object.keys(
  MEMBERSHIP_PRODUCT_DEFS
) as MembershipProductType[];

function normalizeCatalogState(raw: unknown): MembershipCatalogState {
  const state = { ...DEFAULT_STATE };
  if (!raw || typeof raw !== "object") return state;

  for (const type of MEMBERSHIP_PRODUCT_TYPES) {
    const entry = (raw as Record<string, unknown>)[type];
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { published?: unknown; enabled?: unknown };
    state[type] = {
      published:
        typeof row.published === "boolean" ? row.published : state[type].published,
      enabled: typeof row.enabled === "boolean" ? row.enabled : state[type].enabled,
    };
  }
  return state;
}

export async function getMembershipCatalogState(): Promise<MembershipCatalogState> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return { ...DEFAULT_STATE };
  try {
    return normalizeCatalogState(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function updateMembershipCatalogState(
  productType: MembershipProductType,
  patch: Partial<{ published: boolean; enabled: boolean }>
) {
  const current = await getMembershipCatalogState();
  const next: MembershipCatalogState = {
    ...current,
    [productType]: {
      ...current[productType],
      ...patch,
    },
  };

  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: SETTING_KEY, value: JSON.stringify(next), type: "json" },
  });

  return next[productType];
}

export function membershipDefToProduct(
  type: MembershipProductType,
  state: MembershipCatalogState[MembershipProductType]
): Product {
  const def = MEMBERSHIP_PRODUCT_DEFS[type];
  return {
    id: def.id,
    category: "membership",
    name: def.name,
    description: def.description,
    intro: def.intro,
    highlights: def.highlights,
    price: formatProductPrice(def.price),
    stock: 999,
    badge: def.badge,
    accent: def.accent,
    cover: def.cover,
    productType: type,
  };
}

export async function getPublishedMembershipProducts(): Promise<Product[]> {
  const state = await getMembershipCatalogState();
  return MEMBERSHIP_PRODUCT_TYPES.filter(
    (type) => state[type].published && state[type].enabled
  ).map((type) => membershipDefToProduct(type, state[type]));
}

export async function isMembershipProductAvailable(
  productType: MembershipProductType
): Promise<boolean> {
  const state = await getMembershipCatalogState();
  return state[productType].published && state[productType].enabled;
}

export async function listMembershipProductsForAdmin(): Promise<MembershipProductAdmin[]> {
  const state = await getMembershipCatalogState();
  return MEMBERSHIP_PRODUCT_TYPES.map((type) => {
    const def = MEMBERSHIP_PRODUCT_DEFS[type];
    return {
      ...def,
      priceLabel: formatProductPrice(def.price),
      published: state[type].published,
      enabled: state[type].enabled,
    };
  });
}