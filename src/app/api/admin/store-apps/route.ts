import { NextRequest } from "next/server";
import { auditAdminAction } from "@/lib/admin-audit-log";
import { fail, ok } from "@/lib/api-response";
import { ApiError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { createStoreAppSchema } from "@/lib/store-apps-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const apps = await prisma.storeApp.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(apps);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Admin StoreApps GET]", error);
    return fail("获取商店应用失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const parsed = createStoreAppSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const existing = await prisma.storeApp.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return fail("slug 已存在", 40900, 409);

    const created = await prisma.storeApp.create({ data: parsed.data });
    await auditAdminAction(req, session.user.id, "store_apps.create", {
      targetType: "store_app",
      targetId: created.id,
      detail: JSON.stringify({ slug: created.slug }),
    });
    return ok(created, undefined, 201);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Admin StoreApps POST]", error);
    return fail("创建商店应用失败", 50000, 500);
  }
}
