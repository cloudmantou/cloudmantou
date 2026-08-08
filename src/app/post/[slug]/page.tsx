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
import {
  ENGLISH_POST_TRANSLATION_LOCALE,
  ENGLISH_POST_TRANSLATION_STATUS,
  getPublishedEnglishTranslation,
} from "@/lib/editorial-translations";
import { localizeEditorialTaxonomy } from "@/lib/editorial-article";
import { canUseStaticEnglishMantouFallback } from "@/lib/editorial-static-fallback";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const baseCtx = await getSeoContext(locale);
  const ctx = withEditorialSeoContext(baseCtx);
  const post = await prisma.post
    .findUnique({
      where: { slug },
      select: {
        title: true,
        excerpt: true,
        content: true,
        coverImage: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        socialTitle: true,
        socialDescription: true,
        translations: {
          where: {
            locale: ENGLISH_POST_TRANSLATION_LOCALE,
          },
          select: {
            status: true,
            title: true,
            excerpt: true,
            content: true,
            seoTitle: true,
            seoDescription: true,
            seoKeywords: true,
            socialTitle: true,
            socialDescription: true,
          },
        },
      },
    });

  const translation = post ? getPublishedEnglishTranslation(post.translations) : null;
  if (
    locale === "en"
    && slug === MANTOU_ASSISTANT_ARTICLE.slug
    && canUseStaticEnglishMantouFallback(post)
  ) {
    return buildPageMetadata(ctx, {
      title: MANTOU_ASSISTANT_ARTICLE_EN.title,
      description: MANTOU_ASSISTANT_ARTICLE_EN.excerpt,
      path: `/post/${slug}`,
      type: "article",
      image: MANTOU_ASSISTANT_ARTICLE_EN.coverImage,
    });
  }
  if (locale === "en" && (!post || post.status !== "PUBLISHED" || !translation)) {
    return { title: "Article not found" };
  }
  if (locale === "zh" && !post && slug === MANTOU_ASSISTANT_ARTICLE.slug) {
    return buildPageMetadata(ctx, {
      title: MANTOU_ASSISTANT_ARTICLE.title,
      description: MANTOU_ASSISTANT_ARTICLE.excerpt,
      path: `/post/${slug}`,
      type: "article",
      image: MANTOU_ASSISTANT_ARTICLE.coverImage,
    });
  }
  if (!post || post.status === "DRAFT") {
    return { title: locale === "en" ? "Article not found" : "文章不存在" };
  }

  const localized = locale === "en" && translation ? translation : post;

  return buildPageMetadata(ctx, {
    title: localized.seoTitle || localized.title,
    description: localized.seoDescription || localized.excerpt || undefined,
    keywords: readSeoKeywords(localized.seoKeywords),
    socialTitle: localized.socialTitle || undefined,
    socialDescription: localized.socialDescription || undefined,
    path: `/post/${slug}`,
    type: "article",
    image: post.coverImage,
    translated: Boolean(translation),
  });
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const [session, locale] = await Promise.all([auth(), getRequestLocale()]);

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
      translations: {
        where: {
          locale: ENGLISH_POST_TRANSLATION_LOCALE,
        },
        select: {
          status: true,
          title: true,
          excerpt: true,
          content: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          socialTitle: true,
          socialDescription: true,
          updatedAt: true,
        },
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

  const translation = post ? getPublishedEnglishTranslation(post.translations) : null;
  if (
    locale === "en"
    && slug === MANTOU_ASSISTANT_ARTICLE.slug
    && canUseStaticEnglishMantouFallback(post)
  ) {
    return <EditorialStaticMantouArticle locale={locale} />;
  }
  if (!post || post.status === "DRAFT" || (locale === "en" && (post.status !== "PUBLISHED" || !translation))) {
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
  const localizedCategory = locale === "en" && post.category
    ? { ...post.category, ...localizeEditorialTaxonomy("category", post.category, locale) }
    : post.category;
  const localizedTags = locale === "en"
    ? tags.map((tag) => ({ ...tag, ...localizeEditorialTaxonomy("tag", tag, locale) }))
    : tags;
  const [approvedCommentCount, previousPost, nextPost] = await Promise.all([
    countApprovedPostComments(post.id),
    post.publishedAt
      ? prisma.post.findFirst({
          where: {
            ...buildAdjacentPostWhere("previous", { id: post.id, publishedAt: post.publishedAt }),
            ...(locale === "en" ? {
              status: "PUBLISHED" as const,
              translations: { some: { locale: ENGLISH_POST_TRANSLATION_LOCALE, status: ENGLISH_POST_TRANSLATION_STATUS } },
            } : {}),
          },
          orderBy: EDITORIAL_ADJACENT_ORDER.previous,
          select: {
            slug: true,
            title: true,
            translations: locale === "en" ? {
              where: { locale: ENGLISH_POST_TRANSLATION_LOCALE, status: ENGLISH_POST_TRANSLATION_STATUS },
              select: { title: true },
              take: 1,
            } : false,
          },
        })
      : null,
    post.publishedAt
      ? prisma.post.findFirst({
          where: {
            ...buildAdjacentPostWhere("next", { id: post.id, publishedAt: post.publishedAt }),
            ...(locale === "en" ? {
              status: "PUBLISHED" as const,
              translations: { some: { locale: ENGLISH_POST_TRANSLATION_LOCALE, status: ENGLISH_POST_TRANSLATION_STATUS } },
            } : {}),
          },
          orderBy: EDITORIAL_ADJACENT_ORDER.next,
          select: {
            slug: true,
            title: true,
            translations: locale === "en" ? {
              where: { locale: ENGLISH_POST_TRANSLATION_LOCALE, status: ENGLISH_POST_TRANSLATION_STATUS },
              select: { title: true },
              take: 1,
            } : false,
          },
        })
      : null,
  ]);

  // 统一访问权限判断
  const access = await getPostAccess(
    session?.user?.id || null,
    post.id,
    locale === "en" && translation ? translation.content : post.content,
    locale === "en" ? null : post.paidContent?.content || null,
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
  const localizedPost = locale === "en" && translation ? {
    ...post,
    title: translation.title,
    excerpt: translation.excerpt,
    content: translation.content,
    seoDescription: translation.seoDescription,
    seoKeywords: translation.seoKeywords,
    updatedAt: translation.updatedAt,
  } : post;
  const localizedPreviousPost = previousPost ? {
    slug: previousPost.slug,
    title: locale === "en" && "translations" in previousPost
      ? previousPost.translations?.[0]?.title || previousPost.title
      : previousPost.title,
  } : null;
  const localizedNextPost = nextPost ? {
    slug: nextPost.slug,
    title: locale === "en" && "translations" in nextPost
      ? nextPost.translations?.[0]?.title || nextPost.title
      : nextPost.title,
  } : null;

  return (
    <EditorialShell locale={locale}>
      <JsonLd
        ctx={ctx}
        nonce={nonce}
        variant="extra"
        extra={[
          buildBlogPostingJsonLd(ctx, {
            title: localizedPost.title,
            slug: post.slug,
            excerpt: localizedPost.excerpt,
            seoDescription: localizedPost.seoDescription,
            seoKeywords: readSeoKeywords(localizedPost.seoKeywords),
            categoryName: localizedCategory?.name,
            coverImage: post.coverImage,
            publishedAt: post.publishedAt,
            updatedAt: localizedPost.updatedAt,
            authorName,
          }),
        ]}
      />
      <div className="editorial-post-page">
        <div className="editorial-post-frame">
          <PostContent
            post={{
              id: post.id,
              title: localizedPost.title,
              slug: post.slug,
              content: postContent,
              excerpt: localizedPost.excerpt,
              coverImage: post.coverImage,
              status: post.status,
              publishedAt: post.publishedAt?.toISOString() ?? null,
              updatedAt: localizedPost.updatedAt.toISOString(),
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              commentCount: approvedCommentCount,
              author: post.author,
              category: localizedCategory,
              tags: localizedTags,
              paidContent: post.paidContent
                ? { price: Number(post.paidContent.price) }
                : null,
              isLiked,
            }}
            accessReason={access.reason}
            articleCreditsAvailable={access.articleCreditsAvailable ?? 0}
            commentsData={commentsData}
            locale={locale}
            previousPost={localizedPreviousPost}
            nextPost={localizedNextPost}
          />
        </div>
      </div>
    </EditorialShell>
  );
}
