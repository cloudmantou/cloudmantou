import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 站点设置
  await prisma.siteSetting.upsert({
    where: { key: "site_name" },
    update: { value: "CloudMantou" },
    create: { key: "site_name", value: "CloudMantou", type: "string" },
  });

  await prisma.siteSetting.upsert({
    where: { key: "site_description" },
    update: { value: "个人博客、会员付费内容、自动卡密交付与运营后台一体化平台" },
    create: {
      key: "site_description",
      value: "个人博客、会员付费内容、自动卡密交付与运营后台一体化平台",
      type: "string",
    },
  });

  // 默认分类
  await prisma.category.upsert({
    where: { slug: "engineering" },
    update: {},
    create: {
      name: "工程实践",
      slug: "engineering",
      description: "架构、性能、运维与产品化经验",
    },
  });

  await prisma.category.upsert({
    where: { slug: "frontend" },
    update: {},
    create: {
      name: "前端开发",
      slug: "frontend",
      description: "React、Next.js、CSS 等前端技术",
    },
  });

  await prisma.category.upsert({
    where: { slug: "backend" },
    update: {},
    create: {
      name: "后端开发",
      slug: "backend",
      description: "Node.js、数据库、API 设计等后端技术",
    },
  });

  await prisma.category.upsert({
    where: { slug: "devops" },
    update: {},
    create: {
      name: "DevOps",
      slug: "devops",
      description: "Docker、CI/CD、云原生运维",
    },
  });

  // 管理员账号
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@cloudmantou.com" },
    update: {},
    create: {
      email: "admin@cloudmantou.com",
      username: "admin",
      password: adminPassword,
      nickname: "管理员",
      role: "ADMIN",
    },
  });

  // 测试用户
  const userPassword = await bcrypt.hash("user123", 12);
  await prisma.user.upsert({
    where: { email: "test@cloudmantou.com" },
    update: {},
    create: {
      email: "test@cloudmantou.com",
      username: "testuser",
      password: userPassword,
      nickname: "测试用户",
      role: "USER",
    },
  });

  // 示例标签
  const tags = [
    { name: "Next.js", slug: "nextjs", color: "#0070f3" },
    { name: "TypeScript", slug: "typescript", color: "#3178c6" },
    { name: "React", slug: "react", color: "#61dafb" },
    { name: "Docker", slug: "docker", color: "#2496ed" },
    { name: "MySQL", slug: "mysql", color: "#4479a1" },
    { name: "Prisma", slug: "prisma", color: "#2d3748" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  // 示例文章
  const admin = await prisma.user.findUnique({
    where: { email: "admin@cloudmantou.com" },
  });
  const category = await prisma.category.findUnique({
    where: { slug: "engineering" },
  });

  if (admin && category) {
    const post = await prisma.post.upsert({
      where: { slug: "hello-cloudmantou" },
      update: {},
      create: {
        title: "欢迎来到 CloudMantou 博客平台",
        slug: "hello-cloudmantou",
        excerpt: "这是第一篇示例文章，介绍了 CloudMantou 博客会员平台的功能与架构。",
        content: `# 欢迎来到 CloudMantou

CloudMantou 是一个基于 Next.js 14 构建的全栈博客会员平台。

## 主要功能

- 📝 **博客前台**：文章发布、分类、标签、搜索
- 👤 **会员体系**：VIP 会员等级、付费文章
- 💳 **支付集成**：支付宝/微信支付、卡密兑换
- 🛠️ **后台管理**：完整的 CRUD 管理界面

## 技术栈

- **前端**：Next.js 14 (App Router) + TypeScript
- **数据库**：MySQL + Prisma ORM
- **认证**：Auth.js v5 (NextAuth)
- **部署**：Docker

---

感谢使用 CloudMantou！`,
        authorId: admin.id,
        categoryId: category.id,
        status: "PUBLISHED",
        isTop: true,
        publishedAt: new Date(),
      },
    });

    // 给文章添加标签
    const tagRecords = await prisma.tag.findMany({
      where: { slug: { in: ["nextjs", "typescript", "react"] } },
    });

    for (const tag of tagRecords) {
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: tag.id } },
        update: {},
        create: { postId: post.id, tagId: tag.id },
      });
    }
  }

  console.log("✅ Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
