import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/lib/post-access";
import { PostContent } from "./PostContent";
import { MarketingShell } from "@/components/layout/MarketingShell";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, coverImage: true, status: true },
  });

  if (!post || post.status === "DRAFT") {
    return { title: "文章不存在" };
  }

  return {
    title: post.title,
    description: post.excerpt || undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      type: "article",
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
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
      comments: {
        where: { parentId: null, status: "APPROVED" },
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
        take: 10,
      },
    },
  });

  if (!post || post.status === "DRAFT") {
    notFound();
  }

  // Increment view count
  await prisma.$executeRaw`
    UPDATE posts SET viewCount = viewCount + 1 WHERE id = ${post.id}
  `;

  // Check if user has liked
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

  // 统一访问权限判断
  const access = await getPostAccess(
    session?.user?.id || null,
    post.id,
    post.content,
    post.paidContent?.content || null,
    post.status
  );
  const postContent = access.content;

  // Format comments for client
  const formatComment = (c: any): any => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    user: c.user,
    children: (c.replies || []).map(formatComment),
  });

  const commentsData = {
    comments: post.comments.map(formatComment),
    totalCount: post.commentCount,
    hasMore: post.commentCount > 10,
    nextCursor:
      post.comments.length === 10
        ? post.comments[post.comments.length - 1].createdAt.toISOString()
        : null,
  };

  return (
    <MarketingShell>
      <article
        className="min-h-screen px-4 py-10 md:px-8"
        style={{ background: "var(--article-bg)" }}
      >
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <PostContent
            post={{
              id: post.id,
              title: post.title,
              slug: post.slug,
              content: postContent,
              excerpt: post.excerpt,
              coverImage: post.coverImage,
              status: post.status,
              publishedAt: post.publishedAt?.toISOString() ?? null,
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              commentCount: post.commentCount,
              author: post.author,
              category: post.category,
              tags,
              paidContent: post.paidContent
                ? { price: Number(post.paidContent.price) }
                : null,
              isLiked,
            }}
            accessReason={access.reason}
            articleCreditsAvailable={access.articleCreditsAvailable ?? 0}
            commentsData={commentsData}
          />
        </div>
      </article>
    </MarketingShell>
  );
}
