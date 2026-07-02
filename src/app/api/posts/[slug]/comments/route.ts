import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1, "评论内容不能为空").max(1000, "评论内容不能超过1000字"),
  parentId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const { searchParams } = req.nextUrl;
    const cursor = searchParams.get("cursor");
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));

    const post = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    // Fetch top-level comments (no parent)
    const comments = await prisma.comment.findMany({
      where: {
        postId: post.id,
        parentId: null,
        status: "APPROVED",
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        user: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
        replies: {
          where: { status: "APPROVED" },
          include: {
            user: {
              select: { id: true, username: true, nickname: true, avatar: true },
            },
            replies: {
              where: { status: "APPROVED" },
              include: {
                user: {
                  select: { id: true, username: true, nickname: true, avatar: true },
                },
              },
              orderBy: { createdAt: "asc" as const },
            },
          },
          orderBy: { createdAt: "asc" as const },
        },
      },
      orderBy: { createdAt: "desc" as const },
      take: limit + 1, // fetch one extra to check if there's more
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    // Format: flatten replies to children
    const formatted = items.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      children: (c.replies || []).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
        children: (r.replies || []).map((rr) => ({
          id: rr.id,
          content: rr.content,
          createdAt: rr.createdAt.toISOString(),
          user: rr.user,
        })),
      })),
    }));

    return ok({
      comments: formatted,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[Comments List API Error]", error);
    return fail("获取评论失败", 50000, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    // 速率限制：每用户每 10 分钟最多 10 条评论
    const limited = checkRateLimit(req, RATE_LIMITS.COMMENT, session.user.id);
    if (limited) return limited;

    const post = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!post) {
      return fail("文章不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { content, parentId } = parsed.data;

    // Validate parentId if provided
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true },
      });
      if (!parent || parent.postId !== post.id) {
        return fail("父评论不存在", 40000, 400);
      }
    }

    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        userId: session.user.id,
        parentId: parentId || null,
        content,
        // 生产环境默认待审核，开发环境自动通过便于测试
        status: process.env.NODE_ENV === "production" ? "PENDING" : "APPROVED",
      },
      include: {
        user: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
      },
    });

    // Increment comment count
    await prisma.post.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    });

    return ok({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      children: [],
    });
  } catch (error) {
    console.error("[Create Comment API Error]", error);
    return fail("评论失败", 50000, 500);
  }
}
