import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSeoContext } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url: baseUrl } = await getSeoContext();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    // Published posts
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
    });

    const postPages: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${baseUrl}/post/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Categories
    const categories = await prisma.category.findMany({
      select: { slug: true },
    });

    const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...postPages, ...categoryPages];
  } catch {
    // If DB is not available during build, return static pages only
    return staticPages;
  }
}
