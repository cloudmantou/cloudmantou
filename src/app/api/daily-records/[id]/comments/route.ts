import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit-server";
import { getInitialCommentStatus } from "@/lib/site-settings";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1, "评论内容不能为空").max(500, "评论内容不能超过500字"),
  parentId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { searchParams } = req.nextUrl;
    const cursor = searchParams.get("cursor");
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));

    const record = await prisma.dailyRecord.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });

    if (!record || record.visibility !== "public") {
      return fail("记录不存在", 40400, 404);
    }

    const [totalCount, comments] = await Promise.all([
      prisma.dailyRecordComment.count({
        where: { recordId: id, parentId: null, status: "APPROVED" },
      }),
      prisma.dailyRecordComment.findMany({
        where: {
          recordId: id,
          parentId: null,
          status: "APPROVED",
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      }),
    ]);

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return ok({
      comments: items.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        user: c.user,
      })),
      totalCount,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[Daily Comments List Error]", error);
    return fail("获取评论失败", 50000, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const limited = await checkRateLimit(req, RATE_LIMITS.COMMENT, session.user.id);
    if (limited) return limited;

    const record = await prisma.dailyRecord.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });

    if (!record || record.visibility !== "public") {
      return fail("记录不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { content, parentId } = parsed.data;

    if (parentId) {
      const parent = await prisma.dailyRecordComment.findUnique({
        where: { id: parentId },
        select: { id: true, recordId: true },
      });
      if (!parent || parent.recordId !== record.id) {
        return fail("父评论不存在", 40000, 400);
      }
    }

    const initialStatus = await getInitialCommentStatus();

    const comment = await prisma.dailyRecordComment.create({
      data: {
        recordId: record.id,
        userId: session.user.id,
        parentId: parentId || null,
        content,
        status: initialStatus,
      },
      include: {
        user: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
      },
    });

    if (initialStatus === "APPROVED") {
      await prisma.dailyRecord.update({
        where: { id: record.id },
        data: { commentCount: { increment: 1 } },
      });
    }

    return ok({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
    });
  } catch (error) {
    console.error("[Daily Comment Create Error]", error);
    return fail("评论失败", 50000, 500);
  }
}