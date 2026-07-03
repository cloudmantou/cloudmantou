import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { cardPackageToProduct, countActiveCardStock } from "@/lib/card-packages";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

const MEMBERSHIP_CATALOG: Product[] = [
  {
    id: "vip-month",
    category: "membership",
    name: "月度会员",
    description: "解锁所有会员文章、下载附件和会员评论标识。",
    intro:
      "适合想先体验一个月会员内容的读者。开通后可阅读全站会员文章、显示会员标识，并下载文章附件。\n\n到期前可续费，未过期续费会从当前到期日顺延。",
    highlights: ["全站会员文章", "附件下载", "会员评论标识", "随时可续费"],
    price: "¥29",
    stock: 999,
    badge: "HOT",
    accent: "gold",
    productType: "VIP_MONTH",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.28), rgba(232,185,100,0.04)), url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80')",
  },
  {
    id: "vip-year",
    category: "membership",
    name: "年度会员",
    description: "适合长期订阅，包含后续新增会员专栏。",
    intro:
      "为长期读者准备的优惠套餐。一次订阅全年有效，后续新增的会员专栏也会自动纳入权益范围。\n\n相比按月购买可节省约 40%，适合深度用户与团队学习账号。",
    highlights: ["全年会员权益", "新增专栏自动解锁", "性价比更高", "支持叠加续期"],
    price: "¥199",
    stock: 999,
    badge: "SAVE",
    accent: "teal",
    productType: "VIP_YEAR",
    cover:
      "linear-gradient(135deg, rgba(77,217,182,0.26), rgba(77,217,182,0.04)), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80')",
  },
];

export async function GET() {
  try {
    const packages = await prisma.cardPackage.findMany({
      where: { published: true, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const cardProducts: Product[] = [];
    for (const pkg of packages) {
      const stock = await countActiveCardStock(prisma, pkg.cardType, pkg.cardValue);
      cardProducts.push(cardPackageToProduct(pkg, stock));
    }

    return ok([...MEMBERSHIP_CATALOG, ...cardProducts]);
  } catch (error) {
    console.error("[Products GET]", error);
    return fail("获取商品列表失败", 50000, 500);
  }
}