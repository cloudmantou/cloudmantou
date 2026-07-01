import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPosts } from "./CategoryPosts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!category) {
    return { title: "分类不存在" };
  }

  return {
    title: `${category.name} - 文章分类`,
    description: category.description || undefined,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { posts: { where: { status: "PUBLISHED" } } },
      },
    },
  });

  if (!category) {
    notFound();
  }

  // Fetch first page of posts server-side
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: category.id,
    },
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
    },
    orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
    take: 10,
  });

  const total = category._count.posts;
  const formattedPosts = posts.map((p) => ({
    ...p,
    tags: p.tags.map((pt) => pt.tag),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    content: undefined,
  }));

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      {/* Category header */}
      <div className="page-head" style={{ marginBottom: 28 }}>
        <h1 className="page-title">{category.name}</h1>
        {category.description && (
          <p className="page-desc">{category.description}</p>
        )}
        <p
          className="text-xs mt-2"
          style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
        >
          共 {total} 篇文章
        </p>
      </div>

      <CategoryPosts
        categoryId={category.id}
        initialPosts={formattedPosts}
        initialHasMore={total > 10}
      />
    </div>
  );
}
