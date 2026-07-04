import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import {
  listMembershipProductsForAdmin,
  updateMembershipCatalogState,
  type MembershipProductType,
} from "@/lib/membership-catalog";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  productType: z.enum(["VIP_MONTH", "VIP_YEAR"]),
  published: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    return ok(await listMembershipProductsForAdmin());
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin MembershipProducts GET]", error);
    return fail("获取会员商品失败", 50000, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdminAndAudit(req, "membership_products.update");
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { productType, published, enabled } = parsed.data;
    if (published === undefined && enabled === undefined) {
      return fail("请指定 published 或 enabled", 42200, 422);
    }

    const next = await updateMembershipCatalogState(
      productType as MembershipProductType,
      {
        ...(published !== undefined && { published }),
        ...(enabled !== undefined && { enabled }),
      }
    );

    const list = await listMembershipProductsForAdmin();
    const updated = list.find((item) => item.productType === productType);
    return ok(updated ? { ...updated, ...next } : { productType, ...next });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin MembershipProducts PUT]", error);
    return fail("更新会员商品失败", 50000, 500);
  }
}