import { prisma } from "@/lib/prisma";
import { getSeoContext, withEditorialSeoContext } from "@/lib/seo";

export const dynamic = "force-dynamic";

function oneLine(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .trim();
}

export async function GET() {
  const context = withEditorialSeoContext(await getSeoContext("zh"));
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: {
      slug: true,
      title: true,
      seoTitle: true,
      excerpt: true,
      seoDescription: true,
      updatedAt: true,
    },
    orderBy: [{ isTop: "desc" }, { publishedAt: "desc" }],
    take: 200,
  });

  const lines = [
    `# ${oneLine(context.name)}`,
    "",
    `> ${oneLine(context.description)}`,
    "",
    "## Articles",
    "",
    ...posts.map((post) => {
      const description = oneLine(post.seoDescription || post.excerpt || "技术与产品实践记录");
      return `- [${oneLine(post.seoTitle || post.title)}](${context.url}/post/${encodeURIComponent(post.slug)}): ${description} (updated ${post.updatedAt.toISOString().slice(0, 10)})`;
    }),
    "",
    "## Public indexes",
    "",
    `- [Sitemap](${context.url}/sitemap.xml)`,
    `- [Article archive](${context.url}/blog)`,
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
