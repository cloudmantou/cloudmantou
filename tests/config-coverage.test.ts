import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  findMany: vi.fn<() => Promise<Array<{ key: string; value: string }>>>(),
  findUnique: vi.fn<() => Promise<{ value: string } | null>>(),
  upsert: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: {
      findMany: prismaMock.findMany,
      findUnique: prismaMock.findUnique,
      upsert: prismaMock.upsert,
    },
  },
}));

import {
  DEFAULT_HOME_TYPING_PHRASES,
  getInitialCommentStatus,
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@/lib/site-settings";
import {
  getMembershipCatalogState,
  getPublishedMembershipProducts,
  isMembershipProductAvailable,
  listMembershipProductsForAdmin,
  membershipDefToProduct,
  updateMembershipCatalogState,
} from "@/lib/membership-catalog";

describe("site settings production exports", () => {
  beforeEach(() => {
    invalidateSiteSettingsCache();
    prismaMock.findMany.mockReset();
    prismaMock.findUnique.mockReset();
    prismaMock.upsert.mockReset();
  });

  it("returns defaults and reuses the short-lived cache", async () => {
    prismaMock.findMany.mockResolvedValue([]);

    const first = await getSiteSettings();
    const second = await getSiteSettings();

    expect(first).toMatchObject({
      openRegistration: true,
      commentReview: true,
      maintenanceMode: false,
      homeTypingPhrases: DEFAULT_HOME_TYPING_PHRASES,
      contactLinks: [],
    });
    expect(second).toBe(first);
    expect(prismaMock.findMany).toHaveBeenCalledTimes(1);
  });

  it("parses persisted booleans, phrases, branding, and contact links", async () => {
    prismaMock.findMany.mockResolvedValue([
      { key: "openRegistration", value: "false" },
      { key: "commentReview", value: "false" },
      { key: "maintenanceMode", value: "true" },
      { key: "siteUrl", value: "https://settings.example" },
      { key: "siteName", value: "Configured name" },
      { key: "siteSubtitle", value: "Configured subtitle" },
      { key: "siteDescription", value: "Configured description" },
      { key: "homeTypingPhrases", value: JSON.stringify(["First", " ", 42, "Second"]) },
      {
        key: "contactLinks",
        value: JSON.stringify([
          {
            id: "github",
            kind: "github",
            label: "GitHub",
            enabled: true,
            sortOrder: 1,
            href: "https://github.com/cloudmantou",
          },
        ]),
      },
    ]);

    const settings = await getSiteSettings();

    expect(settings).toMatchObject({
      openRegistration: false,
      commentReview: false,
      maintenanceMode: true,
      siteUrl: "https://settings.example",
      siteName: "Configured name",
      siteSubtitle: "Configured subtitle",
      siteDescription: "Configured description",
      homeTypingPhrases: ["First", "Second"],
    });
    expect(settings.contactLinks).toHaveLength(1);
    expect(await getInitialCommentStatus()).toBe("APPROVED");
    expect(prismaMock.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps default phrases for malformed or empty persisted JSON", async () => {
    prismaMock.findMany.mockResolvedValue([
      { key: "homeTypingPhrases", value: "not-json" },
    ]);
    expect((await getSiteSettings()).homeTypingPhrases).toBe(DEFAULT_HOME_TYPING_PHRASES);

    invalidateSiteSettingsCache();
    prismaMock.findMany.mockResolvedValue([
      { key: "homeTypingPhrases", value: JSON.stringify(["", 12, null]) },
    ]);
    expect((await getSiteSettings()).homeTypingPhrases).toBe(DEFAULT_HOME_TYPING_PHRASES);
    expect(await getInitialCommentStatus()).toBe("PENDING");
  });
});

describe("membership catalog production exports", () => {
  beforeEach(() => {
    prismaMock.findUnique.mockReset();
    prismaMock.upsert.mockReset();
  });

  it("uses defaults for missing and malformed settings", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ value: "{" });

    const missing = await getMembershipCatalogState();
    const malformed = await getMembershipCatalogState();

    expect(missing).toEqual({
      VIP_MONTH: { published: true, enabled: true },
      VIP_YEAR: { published: true, enabled: true },
    });
    expect(malformed).toEqual({
      VIP_MONTH: { published: true, enabled: true },
      VIP_YEAR: { published: true, enabled: true },
    });
  });

  it("normalizes partial state and ignores values with the wrong type", async () => {
    prismaMock.findUnique.mockResolvedValue({
      value: JSON.stringify({
        VIP_MONTH: { published: false, enabled: "no" },
        VIP_YEAR: { published: "no", enabled: false },
      }),
    });

    await expect(getMembershipCatalogState()).resolves.toEqual({
      VIP_MONTH: { published: false, enabled: true },
      VIP_YEAR: { published: true, enabled: false },
    });
  });

  it("merges an update and persists the complete catalog state", async () => {
    prismaMock.findUnique.mockResolvedValue({
      value: JSON.stringify({ VIP_MONTH: { published: true, enabled: true } }),
    });
    prismaMock.upsert.mockResolvedValue({});

    const updated = await updateMembershipCatalogState("VIP_MONTH", { enabled: false });

    expect(updated).toEqual({ published: true, enabled: false });
    expect(prismaMock.upsert).toHaveBeenCalledWith({
      where: { key: "membershipCatalog" },
      update: { value: expect.stringContaining('"enabled":false') },
      create: {
        key: "membershipCatalog",
        value: expect.stringContaining('"enabled":false'),
        type: "json",
      },
    });
  });

  it("filters public products while retaining both entries for administrators", async () => {
    prismaMock.findUnique.mockResolvedValue({
      value: JSON.stringify({
        VIP_MONTH: { published: true, enabled: false },
        VIP_YEAR: { published: true, enabled: true },
      }),
    });

    const publicProducts = await getPublishedMembershipProducts();
    const adminProducts = await listMembershipProductsForAdmin();

    expect(publicProducts.map((product) => product.productType)).toEqual(["VIP_YEAR"]);
    expect(publicProducts[0]).toMatchObject({ category: "membership", price: "¥199", stock: 999 });
    expect(adminProducts).toHaveLength(2);
    expect(adminProducts.find((product) => product.productType === "VIP_MONTH")).toMatchObject({
      enabled: false,
      priceLabel: "¥29",
    });
    await expect(isMembershipProductAvailable("VIP_MONTH")).resolves.toBe(false);
    await expect(isMembershipProductAvailable("VIP_YEAR")).resolves.toBe(true);
  });

  it("maps a membership definition into the public product contract", () => {
    expect(
      membershipDefToProduct("VIP_MONTH", { published: true, enabled: true })
    ).toMatchObject({
      id: "vip-month",
      productType: "VIP_MONTH",
      badge: "HOT",
      accent: "gold",
      price: "¥29",
    });
  });
});
