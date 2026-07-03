import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { getPostAccess, unlockPostWithArticleCredit } from "@/lib/post-access";

const UNLOCK_ERRORS: Record<string, { message: string; code: number; status: number }> = {
  not_paid_post: { message: "该文章不是付费内容", code: 40000, status: 400 },
  no_credit: { message: "没有可用的文章券额度", code: 40000, status: 400 },
  already_entitled: { message: "您已拥有该文章阅读权限", code: 40000, status: 400 },
  concurrent_conflict: { message: "文章券正在被占用，请稍后重试", code: 40900, status: 409 },
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const { slug } = await params;
    const post = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        content: true,
        status: true,
        paidContent: { select: { content: true } },
      },
    });

    if (!post || post.status === "DRAFT") {
      return fail("文章不存在", 40400, 404);
    }

    const unlock = await unlockPostWithArticleCredit(session.user.id, post.id);
    if (!unlock.success) {
      const err = UNLOCK_ERRORS[unlock.reason] || {
        message: "解锁失败",
        code: 50000,
        status: 500,
      };
      return fail(err.message, err.code, err.status);
    }

    const access = await getPostAccess(
      session.user.id,
      post.id,
      post.content,
      post.paidContent?.content || null,
      post.status
    );

    return ok({
      unlocked: true,
      accessReason: access.reason,
      content: access.content,
    });
  } catch (error) {
    console.error("[Post Unlock Error]", error);
    return fail("解锁失败", 50000, 500);
  }
}