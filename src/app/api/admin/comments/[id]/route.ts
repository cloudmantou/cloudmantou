import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { onCommentDeleted, onCommentStatusChange } from "@/lib/comment-count";
import { z } from "zod";

const updateCommentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const comment = await prisma.comment.findUnique({ where: { id: id } });
    if (!comment) {
      return fail("评论不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updateCommentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const previousStatus = comment.status;
    const nextStatus = parsed.data.status;

    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: { status: nextStatus },
      });

      await onCommentStatusChange(tx, comment.postId, previousStatus, nextStatus);
    });

    return ok({ id, status: nextStatus });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Update Comment Error]", error);
    return fail("更新评论状态失败", 50000, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const comment = await prisma.comment.findUnique({ where: { id: id } });
    if (!comment) {
      return fail("评论不存在", 40400, 404);
    }

    await prisma.$transaction(async (tx) => {
      await onCommentDeleted(tx, comment.postId, comment.status);
      await tx.comment.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Delete Comment Error]", error);
    return fail("删除评论失败", 50000, 500);
  }
}
