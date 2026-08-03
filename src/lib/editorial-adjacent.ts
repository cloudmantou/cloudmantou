import type { Prisma } from "@prisma/client";

export type AdjacentDirection = "previous" | "next";

export type AdjacentPostAnchor = {
  id: string;
  publishedAt: Date;
};

export const EDITORIAL_ADJACENT_ORDER = {
  previous: [{ publishedAt: "desc" }, { id: "desc" }],
  next: [{ publishedAt: "asc" }, { id: "asc" }],
} as const satisfies Record<AdjacentDirection, Prisma.PostOrderByWithRelationInput[]>;

export function buildAdjacentPostWhere(
  direction: AdjacentDirection,
  anchor: AdjacentPostAnchor
): Prisma.PostWhereInput {
  const dateRelation = direction === "previous" ? "lt" : "gt";
  const idRelation = direction === "previous" ? "lt" : "gt";

  return {
    status: { in: ["PUBLISHED", "PAID_ONLY"] },
    OR: [
      { publishedAt: { [dateRelation]: anchor.publishedAt } },
      { publishedAt: anchor.publishedAt, id: { [idRelation]: anchor.id } },
    ],
  };
}
