import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("未登录", 40100, 401);
    }

    const { slug } = params;
    const post = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    const userId = session.user.id;
    const postId = post.id;

    // Toggle like in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_postId: { userId, postId } },
      });

      if (existing) {
        // Unlike
        await tx.like.delete({
          where: { userId_postId: { userId, postId } },
        });
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        });
        const updated = await tx.post.findUnique({
          where: { id: postId },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: updated?.likeCount ?? 0 };
      } else {
        // Like
        await tx.like.create({
          data: { userId, postId },
        });
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        });
        const updated = await tx.post.findUnique({
          where: { id: postId },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: updated?.likeCount ?? 0 };
      }
    });

    return ok(result);
  } catch (error) {
    console.error("[Like API Error]", error);
    return fail("操作失败", 50000, 500);
  }
}
