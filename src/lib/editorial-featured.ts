import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";

export const EDITORIAL_FEATURED_LIMIT = 5;
export const EDITORIAL_RECENT_LIMIT = 5;

const PUBLIC_STATUSES = new Set<EditorialPostCardData["status"]>([
  "PUBLISHED",
  "PAID_ONLY",
]);

const HOMEPAGE_UTILITY_PATTERNS = [
  /隐私政策|隐私说明|privacy[-_\s]?policy/i,
  /使用帮助|技术支持|help[-_\s]?center|support[-_\s]?guide/i,
  /欢迎来到\s*CloudMantou|welcome[-_\s]?to[-_\s]?cloudmantou/i,
];

export function isHomepageUtilityPost(
  post: Pick<EditorialPostCardData, "slug" | "title">,
): boolean {
  const target = `${post.slug} ${post.title}`;
  return HOMEPAGE_UTILITY_PATTERNS.some((pattern) => pattern.test(target));
}

export function selectEditorialHomepagePosts(posts: EditorialPostCardData[]) {
  const publicPosts = posts
    .filter((post) => PUBLIC_STATUSES.has(post.status))
    .filter(
      (post, index, candidates) =>
        candidates.findIndex((candidate) => candidate.slug === post.slug) === index,
    );
  const editorialPosts = publicPosts.filter((post) => !isHomepageUtilityPost(post));
  const candidatePosts = editorialPosts.length > 0 ? editorialPosts : publicPosts;

  const explicitlyFeatured = candidatePosts.filter((post) => post.isTop);
  const featuredPosts = (
    explicitlyFeatured.length > 0 ? explicitlyFeatured : candidatePosts
  ).slice(0, EDITORIAL_FEATURED_LIMIT);
  const featuredSlugs = new Set(featuredPosts.map((post) => post.slug));
  const recentPosts = [...candidatePosts]
    .filter((post) => !featuredSlugs.has(post.slug))
    .sort((left, right) => {
      const dateDifference = (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0);
      return dateDifference || left.slug.localeCompare(right.slug);
    })
    .slice(0, EDITORIAL_RECENT_LIMIT);

  return { featuredPosts, recentPosts };
}
