import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";

export const EDITORIAL_FEATURED_LIMIT = 5;
export const EDITORIAL_RECENT_LIMIT = 5;

const PUBLIC_STATUSES = new Set<EditorialPostCardData["status"]>([
  "PUBLISHED",
  "PAID_ONLY",
]);

export function selectEditorialHomepagePosts(posts: EditorialPostCardData[]) {
  const publicPosts = posts
    .filter((post) => PUBLIC_STATUSES.has(post.status))
    .filter(
      (post, index, candidates) =>
        candidates.findIndex((candidate) => candidate.slug === post.slug) === index,
    );
  const explicitlyFeatured = publicPosts.filter((post) => post.isTop);
  const featuredPosts = (
    explicitlyFeatured.length > 0 ? explicitlyFeatured : publicPosts
  ).slice(0, EDITORIAL_FEATURED_LIMIT);
  const featuredSlugs = new Set(featuredPosts.map((post) => post.slug));
  const recentPosts = [...publicPosts]
    .filter((post) => !featuredSlugs.has(post.slug))
    .sort((left, right) => {
      const dateDifference = (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0);
      return dateDifference || left.slug.localeCompare(right.slug);
    })
    .slice(0, EDITORIAL_RECENT_LIMIT);

  return { featuredPosts, recentPosts };
}
