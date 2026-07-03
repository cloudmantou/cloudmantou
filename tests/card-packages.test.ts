import { describe, expect, it } from "vitest";
import { cardPackageToProduct } from "@/lib/card-packages";
import type { CardPackage } from "@prisma/client";

describe("cardPackageToProduct", () => {
  it("maps published package with intro fields to shop product", () => {
    const pkg = {
      id: "pkg-1",
      slug: "vip-30",
      name: "VIP 30 天卡密",
      description: "兑换后延长 30 天会员",
      intro: "详细介绍段落",
      highlights: ["亮点 A", "亮点 B"],
      usageSteps: ["步骤 1", "步骤 2"],
      cardType: "VIP_DAYS",
      cardValue: 30,
      price: { toString: () => "25" } as unknown as CardPackage["price"],
      badge: "HOT",
      accent: "gold",
      cover: null,
      enabled: true,
      published: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CardPackage;

    const product = cardPackageToProduct(pkg, 12);
    expect(product.category).toBe("card");
    expect(product.intro).toBe("详细介绍段落");
    expect(product.highlights).toEqual(["亮点 A", "亮点 B"]);
    expect(product.usageSteps).toEqual(["步骤 1", "步骤 2"]);
    expect(product.stock).toBe(12);
    expect(product.productType).toBe("CARD_PACKAGE");
  });
});