# CloudMantou 技术设计

CloudMantou 按照 StarBlog 的思路设计为个人博客 + 会员付费 + 自动卡密交付平台。当前仓库先落地可运行的 Next.js 14 工程骨架、Prisma 数据模型、API 响应规范和参考样式前端。

## 产品边界

- 博客前台：公开文章、会员文章、单篇付费文章共用 `Post` 内容模型。
- 会员中心：展示会员状态、订单、卡密兑换、个人资料和安全设置。
- 后台管理：文章、评论、用户、订单、卡密、支付记录和系统设置。
- 支付与交付：订单支付成功后通过 entitlement 解锁会员或文章，通过 card delivery 完成自动发卡。

## 前端视觉

前端风格来自 `/Users/mantou/Downloads/code (1).html`：

- 深色工作台背景，固定侧边栏，移动端顶部栏和底部导航。
- `Syne` 用于标题和数字，`Noto Serif SC` 用于中文正文，`DM Mono` 用于标签与指标。
- 主色为金色，辅助色为青色、玫红、蓝色、橙色。
- 卡片用于文章、商品、指标和后台模块；筛选按钮与选中态保持同一套强调色。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript
- Prisma ORM + MySQL
- Zod 输入校验
- Vitest 单元测试
- Docker Compose 本地 MySQL/Redis 编排

## 当前实现

- `src/app/page.tsx`：可交互前台原型，包含首页、博客、会员/卡密、运营记录。
- `src/app/dashboard/page.tsx`：会员中心信息架构页。
- `src/app/admin/page.tsx`：后台管理信息架构页。
- `src/app/api/posts/route.ts`：文章列表 API envelope 示例。
- `src/app/api/cards/verify/route.ts`：卡密兑换输入校验和不可变状态转换示例。
- `prisma/schema.prisma`：用户、文章、付费内容、订单、支付、卡密、权限和站点配置模型。

## 后续阶段

1. 接入 Auth.js，完成注册、登录、角色和 middleware 鉴权。
2. 将 mock 数据替换为 Prisma repository，并补数据库迁移与 seed。
3. 实现文章 CRUD、Markdown 编辑器、分类标签和评论审核。
4. 接入支付宝/微信支付回调，补验签、幂等和订单状态机。
5. 完成卡密批量生成、导出、库存锁定和交付补偿。
6. 增加 E2E 覆盖首页、登录、购买、支付回调和卡密兑换关键路径。
