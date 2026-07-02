import { requireAuth, requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const record = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!record) return fail("记录不存在", 40400, 404);

    // Only author or admin can delete
    if (record.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return fail("无权删除此记录", 40300, 403);
    }

    await prisma.dailyRecord.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Daily Record Delete Error]", error);
    return fail("删除记录失败", 50000, 500);
  }
}
