# CloudMantou

个人博客 + 会员付费内容 + 自动卡密交付 + 运营后台一体化平台。

## 技术栈

- **框架**: Next.js 15 App Router
- **语言**: TypeScript + React 18
- **数据库**: MySQL 8.0 + Prisma ORM
- **认证**: NextAuth.js v5 (JWT)
- **UI**: Tailwind CSS + 自定义组件
- **Markdown**: react-markdown + rehype-highlight
- **编辑器**: @uiw/react-md-editor
- **测试**: Vitest

## 功能

### 博客前台
- 文章详情页 (`/post/[slug]`) — Markdown 渲染 + 代码高亮 + 纸质感阅读
- 分类页 (`/category/[slug]`)
- 评论系统 (嵌套回复, 默认通过)
- 点赞功能 (乐观更新)
- 搜索 (Cmd+K 弹窗, 全文搜索)
- 深浅色模式 (系统跟随)

### 后台管理 (`/admin`)
- 文章 CRUD + Markdown 编辑器 (实时预览)
- 分类 / 标签管理
- 评论审核 (通过/拒绝/删除)
- 卡密管理 (批量生成, CSV 导出, 启用/禁用)
- 订单管理 (支付状态, 用户信息)
- 仪表盘 (真实统计数据)

### 会员系统
- 注册 / 登录 (JWT)
- 角色权限 (USER / EDITOR / ADMIN)
- 会员中心 (卡密兑换, 订单历史)
- 付费内容 (部分内容预览 + 价格)

### 支付系统
- 订单状态机 (PENDING → PAID / CANCELLED / EXPIRED / REFUNDED)
- 支付回调接口 (幂等处理, 自动发放权益)
- 支持支付宝 / 微信 / 卡密三种渠道

## 项目结构

```
src/
  app/
    (auth)/           # 登录/注册
    admin/            # 后台管理页面
    api/              # API 路由
    category/[slug]/  # 分类页
    dashboard/        # 会员中心
    post/[slug]/      # 文章详情页
  components/
    admin/            # 后台组件
    blog/             # 博客组件
    layout/           # 布局组件
    shop/             # 商城组件
    ui/               # UI 基础组件
  lib/                # 工具函数
  types/              # TypeScript 类型
prisma/
  schema.prisma       # 数据模型 (13 个模型)
  seed.ts             # 种子数据
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动数据库
docker-compose up -d mysql redis

# 运行迁移
pnpm prisma migrate dev

# 填充种子数据
pnpm prisma db seed

# 启动开发服务器
pnpm dev
```

## 环境变量

```env
DATABASE_URL=mysql://root:dbpass@localhost:3306/starblog
NEXTAUTH_SECRET=your-secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 测试

```bash
pnpm test
```

## 部署

```bash
docker-compose up -d
```
