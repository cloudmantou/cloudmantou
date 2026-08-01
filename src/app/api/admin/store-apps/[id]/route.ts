import { NextRequest } from "next/server";
import { auditAdminAction } from "@/lib/admin-audit-log";
import { fail, ok } from "@/lib/api-response";
import { ApiError, requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { updateStoreAppSchema } from "@/lib/store-apps-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const session = await requireAdmin();
    const current = await prisma.storeApp.findUnique({ where: { id } });
    if (!current) return fail("应用不存在", 40400, 404);

    const parsed = updateStoreAppSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    if (parsed.data.slug && parsed.data.slug !== current.slug) {
      const existing = await prisma.storeApp.findUnique({ where: { slug: parsed.data.slug } });
      if (existing) return fail("slug 已存在", 40900, 409);
    }

    const updated = await prisma.storeApp.update({ where: { id }, data: parsed.data });
    await auditAdminAction(req, session.user.id, "store_apps.update", {
      targetType: "store_app",
      targetId: id,
      detail: JSON.stringify({ fields: Object.keys(parsed.data).sort() }),
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Admin StoreApps PUT]", error);
    return fail("更新商店应用失败", 50000, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const session = await requireAdmin();
    const current = await prisma.storeApp.findUnique({ where: { id } });
    if (!current) return fail("应用不存在", 40400, 404);

    await prisma.storeApp.delete({ where: { id } });
    await auditAdminAction(req, session.user.id, "store_apps.delete", {
      targetType: "store_app",
      targetId: id,
      detail: JSON.stringify({ slug: current.slug }),
    });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.code, error.status);
    console.error("[Admin StoreApps DELETE]", error);
    return fail("删除商店应用失败", 50000, 500);
  }
}
