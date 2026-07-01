import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const updateCommentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return fail("评论不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updateCommentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    await prisma.comment.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    });

    return ok({ id: params.id, status: parsed.data.status });
  } catch (error) {
    console.error("[Admin Update Comment Error]", error);
    return fail("更新评论状态失败", 50000, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return fail("评论不存在", 40400, 404);
    }

    // Decrement comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    await prisma.comment.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[Admin Delete Comment Error]", error);
    return fail("删除评论失败", 50000, 500);
  }
}
