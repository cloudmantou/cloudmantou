import { describe, expect, it } from "vitest";
import { buildAdminCardWhere, displayCardStatus } from "@/lib/admin-card-filters";

const where = (query: string) => buildAdminCardWhere(new URLSearchParams(query));

describe("admin card filters", () => {
  it("returns an empty filter when nothing is selected", () => {
    expect(where("")).toEqual({});
  });

  it("keeps the search when filtering sold or redeemed cards", () => {
    expect(where("status=USED&search=ab12")).toEqual({
      AND: [
        { OR: [{ cardNo: { contains: "ab12" } }, { batchNo: { contains: "ab12" } }] },
        { OR: [{ status: "USED" }, { orderId: { not: null } }] },
      ],
    });
  });

  it("treats unsold as active cards without an order", () => {
    expect(where("status=ACTIVE&packageId=pkg_1&excludeType=VIP_DAYS")).toEqual({
      AND: [
        { type: { not: "VIP_DAYS" } },
        { packageId: "pkg_1" },
        { status: "ACTIVE", orderId: null },
      ],
    });
  });

  it("combines type and excludeType instead of overwriting", () => {
    expect(where("type=BALANCE&excludeType=VIP_DAYS&batchNo=B1")).toEqual({
      AND: [{ type: "BALANCE" }, { type: { not: "VIP_DAYS" } }, { batchNo: "B1" }],
    });
  });

  it("ignores unknown enum values instead of passing them to Prisma", () => {
    expect(where("type=NOPE&excludeType=NOPE&status=NOPE&search=%20%20")).toEqual({});
    expect(where("status=DISABLED")).toEqual({ AND: [{ status: "DISABLED" }] });
  });

  it("shows cards attached to an order as sold", () => {
    expect(displayCardStatus({ status: "ACTIVE", orderId: "order_1" })).toBe("SOLD");
    expect(displayCardStatus({ status: "EXPIRED", orderId: null })).toBe("EXPIRED");
  });
});
