import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { getPostAccess } from "@/lib/post-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const session = await auth();

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true, slug: true, color: true } },
          },
        },
        paidContent: {
          select: { content: true, price: true },
        },
      },
    });

    if (!post || post.status === "DRAFT") {
      return fail("文章不存在", 40400, 404);
    }

    // Increment view count atomically
    await prisma.$executeRaw`
      UPDATE posts SET viewCount = viewCount + 1 WHERE id = ${post.id}
    `;

    // Check if current user has liked
    let isLiked = false;
    if (session?.user?.id) {
      const like = await prisma.like.findUnique({
        where: {
          userId_postId: {
            userId: session.user.id,
            postId: post.id,
          },
        },
      });
      isLiked = !!like;
    }

    const tags = post.tags.map((pt) => pt.tag);

    // 统一访问权限判断（和 SSR 页面逻辑一致）
    const access = await getPostAccess(
      session?.user?.id || null,
      post.id,
      post.content,
      post.paidContent?.content || null,
      post.status
    );

    return ok({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: access.content,
      coverImage: post.coverImage,
      status: post.status,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      viewCount: post.viewCount + 1,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      author: post.author,
      category: post.category,
      tags,
      paidContent: post.paidContent
        ? { price: Number(post.paidContent.price) }
        : null,
      isLiked,
      accessReason: access.reason,
      articleCreditsAvailable: access.articleCreditsAvailable ?? 0,
    });
  } catch (error) {
    console.error("[Post Detail API Error]", error);
    return fail("获取文章详情失败", 50000, 500);
  }
}
