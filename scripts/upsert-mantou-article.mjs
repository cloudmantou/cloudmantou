import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const articlePath = new URL("../src/content/mantou-assistant-article.json", import.meta.url);
const article = JSON.parse(await readFile(articlePath, "utf8"));
const databaseArticle = {
  title: article.title,
  slug: article.slug,
  excerpt: article.excerpt,
  content: article.content,
  coverImage: article.coverImage,
};

async function main() {
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!author) throw new Error("No admin user is available for the Mantou Assistant article");

  const category = await prisma.category.upsert({
    where: { slug: "product-notes" },
    update: { name: "产品实践", description: "独立产品、工具开发与真实迭代记录" },
    create: { name: "产品实践", slug: "product-notes", description: "独立产品、工具开发与真实迭代记录" },
  });

  const existingPost = await prisma.post.findUnique({
    where: { slug: article.slug },
    select: { publishedAt: true },
  });
  const publishedAt = existingPost?.publishedAt || new Date();

  const post = await prisma.post.upsert({
    where: { slug: article.slug },
    update: {
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      coverImage: article.coverImage,
      categoryId: category.id,
      status: "PUBLISHED",
      isTop: true,
      publishedAt,
    },
    create: {
      ...databaseArticle,
      authorId: author.id,
      categoryId: category.id,
      status: "PUBLISHED",
      isTop: true,
      publishedAt,
    },
  });

  const tags = [
    { name: "iOS", slug: "ios", color: "#145ee8" },
    { name: "独立开发", slug: "indie-development", color: "#ef432f" },
    { name: "产品实践", slug: "product-practice", color: "#ffd23f" },
  ];
  for (const tag of tags) {
    const record = await prisma.tag.upsert({ where: { slug: tag.slug }, update: tag, create: tag });
    await prisma.postTag.upsert({
      where: { postId_tagId: { postId: post.id, tagId: record.id } },
      update: {},
      create: { postId: post.id, tagId: record.id },
    });
  }

  process.stdout.write(`Mantou Assistant article ready: ${post.slug}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
