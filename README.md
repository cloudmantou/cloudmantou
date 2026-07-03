# CloudMantou

个人博客 + 会员付费内容 + 自动卡密交付 + 运营后台一体化平台。

> **当前阶段：MVP / 内测版** — 核心链路可跑通，但尚未达到生产级安全与运维标准。部署前请阅读下方「功能成熟度」与「已知限制」。

## 技术栈

- **框架**: Next.js 15 App Router
- **语言**: TypeScript + React 18
- **数据库**: MySQL 8.0 + Prisma ORM
- **认证**: NextAuth.js v5 (JWT)
- **UI**: Tailwind CSS + 自定义组件
- **Markdown**: react-markdown + rehype-highlight
- **编辑器**: @uiw/react-md-editor
- **测试**: Vitest

## 功能成熟度

| 模块 | 状态 | 说明 |
|------|------|------|
| 博客前台 | ✅ 可用 | 文章、分类、评论、点赞、Cmd+K 搜索 |
| 会员中心 `/dashboard` | ✅ 可用 | 会员状态、卡密兑换、订单历史、文章券额度 |
| 支付（支付宝 / 微信） | ⚠️ 基础可用 | PC/H5 下单与回调；生产前需验证 CSP、证书轮换 |
| 卡密兑换 | ✅ 可用 | VIP 天数、文章券额度、余额充值 |
| PAID_ARTICLE 文章券 | ✅ 已修复 | 兑换获得额度，首次阅读付费文章时自动绑定 |
| 后台管理 | ✅ 可用 | 文章、评论、卡密、订单、设置 |
| 站点设置联动 | ⚠️ 部分 | `openRegistration`、`commentReview`、`maintenanceMode` 已接入 |
| 卡密套餐在线购买 | ❌ 未开放 | `CARD_PACKAGE` 下单返回暂未开放 |
| Stripe / USDT / 易支付 | ❌ 未实现 | 后台字段预留，无运行时实现 |
| Redis 限流 | ✅ 已接入 | API 路由在 `REDIS_URL` 可用时用 Redis；登录限流因 middleware 打包限制仍用内存 |
| 支付密钥加密 | ✅ 已接入 | 后台网关密钥 AES-256-GCM 加密存储 |
| 微信 V3 回调加固 | ⚠️ 部分 | 时间戳重放窗口 + 平台证书 serial 校验 |
| 本地上传 | ✅ 已优化 | 客户端预压缩 + 服务端 Sharp 魔数校验/WebP 重编码 |
| 对象存储 OSS | ❌ 未接入 | 预留配置，当前默认本地 `public/uploads` |
| 全文搜索引擎 | ❌ 未接入 | 当前为 Prisma `contains` 标题/摘要/正文 |
| EDITOR 角色 | ❌ 未落地 | 枚举存在，发布权限仍仅 ADMIN |

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
    dashboard/        # 会员中心组件
    layout/           # 布局组件
    shop/             # 商城组件
    ui/               # UI 基础组件
  lib/                # 工具函数
  types/              # TypeScript 类型
prisma/
  schema.prisma       # 数据模型
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

# 填充种子数据（开发环境默认管理员 admin / admin123）
pnpm prisma db seed

# 启动开发服务器
pnpm dev
```

## 环境变量

以 `.env.example` 为准（**不要**使用已废弃的 `NEXTAUTH_SECRET` / `NEXT_PUBLIC_SITE_URL`）：

```env
DATABASE_URL=mysql://root:password@localhost:3306/cloudmantou

# 认证（NextAuth v5）
AUTH_SECRET=replace-with-a-32-character-random-secret
AUTH_URL=http://localhost:3000

# 站点（支付回调、外链生成）
SITE_URL=http://localhost:3000
SITE_NAME=CloudMantou

# 卡密哈希盐（必填）
CARD_SECRET_SALT=replace-with-a-random-64-char-hex-string

# 种子数据（生产环境必填强密码）
SEED_ADMIN_PASSWORD=your-strong-password

# 可选
REDIS_URL=redis://localhost:6379
TRUST_PROXY_HEADERS=false
SETTINGS_ENCRYPTION_KEY=optional-dedicated-encryption-key
WECHAT_V3_PLATFORM_SERIAL=wechat-platform-cert-serial
```

支付相关变量见 `.env.example` 中的 `ALIPAY_*`、`WECHAT_*`。

## 测试

```bash
pnpm test
```

## 部署

### Docker Compose（推荐）

1. 复制并填写环境变量（至少 `AUTH_SECRET`、`CARD_SECRET_SALT`、`DB_ROOT_PASSWORD`）：

```bash
cp .env.example .env
# 编辑 .env，设置生产用密钥
```

2. 启动全部服务（应用容器启动时会自动执行 `prisma migrate deploy`，仓库已包含 `prisma/migrations` 初始迁移）：

```bash
docker-compose up -d --build
```

3. **首次部署**初始化数据（生产环境必须设置 `SEED_ADMIN_PASSWORD`）：

```bash
docker-compose exec app npx prisma db seed
```

### 手动部署要点

- 构建前：`pnpm prisma generate`
- 启动前：`pnpm prisma migrate deploy`
- 生产环境：`NODE_ENV=production` 且必须配置 `SEED_ADMIN_PASSWORD`
- 反代需正确传递真实客户端 IP，并配置 `AUTH_URL`、`SITE_URL` 为公网地址
- 图片上传默认写入 `public/uploads`；Docker Compose 已通过 `uploads_data` 卷持久化

### 图片上传（本地存储）

双层压缩链路：

1. **浏览器端**：Canvas 等比缩放并输出 WebP（封面 1600×900、正文 1920、日常 1600）
2. **服务端**：魔数校验 → Sharp 去 EXIF、缩放、WebP 重编码（单文件 ≤ 2MB）

上传接口：`POST /api/admin/upload`（管理员），表单字段 `file` + 可选 `purpose=cover|content|daily|general`

## 默认账号（仅开发）

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

生产环境请勿使用默认密码；未设置 `SEED_ADMIN_PASSWORD` 时 seed 脚本会拒绝执行。

## 已知限制（生产前待办）

- 支付配置变更审计日志
- 微信 V3 平台证书自动轮换（当前需手动更新 serial/公钥）
- 支付宝 form 提交需在真实浏览器验证 CSP 放行效果
- 可选迁移至 OSS/S3（本地存储已支持压缩与 Docker 卷持久化）
- API 集成测试与 Playwright E2E 覆盖购买/兑换闭环