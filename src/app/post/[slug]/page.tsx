import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/lib/post-access";
import { countApprovedPostComments } from "@/lib/comment-count";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCspNonce } from "@/lib/csp-nonce";
import { buildBlogPostingJsonLd, buildPageMetadata, getSeoContext, withEditorialSeoContext } from "@/lib/seo";
import { PostContent } from "./PostContent";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { EditorialStaticMantouArticle } from "@/components/editorial/EditorialStaticArticle";
import {
  MANTOU_ASSISTANT_ARTICLE,
  MANTOU_ASSISTANT_ARTICLE_EN,
} from "@/config/editorial-blog";
import { getRequestLocale } from "@/i18n/server";
import { buildAdjacentPostWhere, EDITORIAL_ADJACENT_ORDER } from "@/lib/editorial-adjacent";
import { readSeoKeywords } from "@/lib/post-schema";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const baseCtx = await getSeoContext(locale);
  const ctx = withEditorialSeoContext(baseCtx);
  if (locale === "en" && slug !== MANTOU_ASSISTANT_ARTICLE.slug) {
    return { title: "Article not found" };
  }
  if (locale === "en" && slug === MANTOU_ASSISTANT_ARTICLE.slug) {
    return buildPageMetadata(ctx, {
      title: MANTOU_ASSISTANT_ARTICLE_EN.title,
      description: MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
      path: `/post/${slug}`,
      type: "article",
      image: MANTOU_ASSISTANT_ARTICLE_EN.coverImage,
    });
  }

  const post = await prisma.post
    .findUnique({
      where: { slug },
      select: {
        title: true,
        excerpt: true,
        coverImage: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        socialTitle: true,
        socialDescription: true,
      },
    })
    .catch((error: unknown) => {
      if (slug === MANTOU_ASSISTANT_ARTICLE.slug) return null;
      throw error;
    });

  if (!post && slug === MANTOU_ASSISTANT_ARTICLE.slug) {
    return buildPageMetadata(ctx, {
      title: MANTOU_ASSISTANT_ARTICLE.title,
      description: MANTOU_ASSISTANT_ARTICLE.excerpt,
      path: `/post/${slug}`,
      type: "article",
      image: MANTOU_ASSISTANT_ARTICLE.coverImage,
    });
  }
  if (!post || post.status === "DRAFT") {
    return { title: "文章不存在" };
  }

  return buildPageMetadata(ctx, {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    keywords: readSeoKeywords(post.seoKeywords),
    socialTitle: post.socialTitle || undefined,
    socialDescription: post.socialDescription || undefined,
    path: `/post/${slug}`,
    type: "article",
    image: post.coverImage,
    translated: slug === MANTOU_ASSISTANT_ARTICLE.slug,
  });
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const [session, locale] = await Promise.all([auth(), getRequestLocale()]);

  if (locale === "en" && slug !== MANTOU_ASSISTANT_ARTICLE.slug) notFound();

  if (locale === "en" && slug === MANTOU_ASSISTANT_ARTICLE.slug) {
    return <EditorialStaticMantouArticle locale={locale} />;
  }

  const post = await prisma.post
    .findUnique({
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
    })
    .catch((error: unknown) => {
      if (slug === MANTOU_ASSISTANT_ARTICLE.slug) return null;
      throw error;
    });

  if (!post && slug === MANTOU_ASSISTANT_ARTICLE.slug) {
    return <EditorialStaticMantouArticle locale={locale} />;
  }
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
  const [approvedCommentCount, previousPost, nextPost] = await Promise.all([
    countApprovedPostComments(post.id),
    post.publishedAt
      ? prisma.post.findFirst({
          where: buildAdjacentPostWhere("previous", {
            id: post.id,
            publishedAt: post.publishedAt,
          }),
          orderBy: EDITORIAL_ADJACENT_ORDER.previous,
          select: { slug: true, title: true },
        })
      : null,
    post.publishedAt
      ? prisma.post.findFirst({
          where: buildAdjacentPostWhere("next", {
            id: post.id,
            publishedAt: post.publishedAt,
          }),
          orderBy: EDITORIAL_ADJACENT_ORDER.next,
          select: { slug: true, title: true },
        })
      : null,
  ]);

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
    totalCount: approvedCommentCount,
    hasMore: approvedCommentCount > 10,
    nextCursor:
      post.comments.length === 10
        ? post.comments[post.comments.length - 1].createdAt.toISOString()
        : null,
  };

  const [baseCtx, nonce] = await Promise.all([getSeoContext(locale), getCspNonce()]);
  const ctx = withEditorialSeoContext(baseCtx);
  const authorName = post.author.nickname || post.author.username;

  return (
    <EditorialShell locale={locale}>
      <JsonLd
        ctx={ctx}
        nonce={nonce}
        variant="extra"
        extra={[
          buildBlogPostingJsonLd(ctx, {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            seoDescription: post.seoDescription,
            seoKeywords: readSeoKeywords(post.seoKeywords),
            categoryName: post.category?.name,
            coverImage: post.coverImage,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            authorName,
          }),
        ]}
      />
      <div className="editorial-post-page">
        <div className="editorial-post-frame">
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
              updatedAt: post.updatedAt.toISOString(),
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              commentCount: approvedCommentCount,
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
            locale={locale}
            previousPost={previousPost}
            nextPost={nextPost}
          />
        </div>
      </div>
    </EditorialShell>
  );
}
