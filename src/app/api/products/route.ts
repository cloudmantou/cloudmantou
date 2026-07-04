import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { cardPackageToProduct, countActiveCardStock } from "@/lib/card-packages";
import { getPublishedMembershipProducts } from "@/lib/membership-catalog";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

async function loadPublishedCardProducts(): Promise<Product[]> {
  try {
    const packages = await prisma.cardPackage.findMany({
      where: { published: true, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const cardProducts: Product[] = [];
    for (const pkg of packages) {
      const stock = await countActiveCardStock(prisma, pkg.id);
      cardProducts.push(cardPackageToProduct(pkg, stock));
    }
    return cardProducts;
  } catch (error) {
    console.error("[Products GET] card packages unavailable:", error);
    return [];
  }
}

export async function GET() {
  const [membershipProducts, cardProducts] = await Promise.all([
    getPublishedMembershipProducts(),
    loadPublishedCardProducts(),
  ]);
  return ok([...membershipProducts, ...cardProducts]);
}