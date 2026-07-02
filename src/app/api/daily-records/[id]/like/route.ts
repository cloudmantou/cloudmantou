import { requireAuth, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id: recordId } = await params;

    const record = await prisma.dailyRecord.findUnique({ where: { id: recordId } });
    if (!record) return fail("记录不存在", 40400, 404);

    const existing = await prisma.dailyRecordLike.findUnique({
      where: { userId_recordId: { userId: session.user.id, recordId } },
    });

    if (existing) {
      // Unlike
      await prisma.dailyRecordLike.delete({ where: { id: existing.id } });
      await prisma.dailyRecord.update({
        where: { id: recordId },
        data: { likeCount: { decrement: 1 } },
      });
      return ok({ liked: false, likeCount: Math.max(0, record.likeCount - 1) });
    } else {
      // Like
      await prisma.dailyRecordLike.create({
        data: { userId: session.user.id, recordId },
      });
      await prisma.dailyRecord.update({
        where: { id: recordId },
        data: { likeCount: { increment: 1 } },
      });
      return ok({ liked: true, likeCount: record.likeCount + 1 });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Daily Record Like Error]", error);
    return fail("操作失败", 50000, 500);
  }
}
