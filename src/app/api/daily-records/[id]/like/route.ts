import { requireAuth, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id: recordId } = await params;

    const record = await prisma.dailyRecord.findUnique({
      where: { id: recordId },
      select: { id: true },
    });
    if (!record) return fail("记录不存在", 40400, 404);

    const userId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyRecordLike.findUnique({
        where: { userId_recordId: { userId, recordId } },
      });

      if (existing) {
        await tx.dailyRecordLike.delete({ where: { id: existing.id } });
        await tx.dailyRecord.update({
          where: { id: recordId },
          data: { likeCount: { decrement: 1 } },
        });
        const updated = await tx.dailyRecord.findUnique({
          where: { id: recordId },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated?.likeCount ?? 0) };
      }

      await tx.dailyRecordLike.create({
        data: { userId, recordId },
      });
      await tx.dailyRecord.update({
        where: { id: recordId },
        data: { likeCount: { increment: 1 } },
      });
      const updated = await tx.dailyRecord.findUnique({
        where: { id: recordId },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated?.likeCount ?? 0 };
    });

    return ok(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Daily Record Like Error]", error);
    return fail("操作失败", 50000, 500);
  }
}