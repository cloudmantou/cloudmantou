import { requireAdminAndAudit, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { dailyRecordUpdateSchema } from "@/lib/daily-record-schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdminAndAudit(req, "daily_records.update", { targetType: "daily_record", targetId: id });
    const body = await req.json();
    const parsed = dailyRecordUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const record = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!record) return fail("记录不存在", 40400, 404);

    const updated = await prisma.dailyRecord.update({
      where: { id },
      data: parsed.data,
    });

    return ok({ id: updated.id, isTop: updated.isTop, visibility: updated.visibility });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Daily Record Update Error]", error);
    return fail("更新记录失败", 50000, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdminAndAudit(req, "daily_records.delete", { targetType: "daily_record", targetId: id });

    const record = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!record) return fail("记录不存在", 40400, 404);

    await prisma.dailyRecord.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Daily Record Delete Error]", error);
    return fail("删除记录失败", 50000, 500);
  }
}