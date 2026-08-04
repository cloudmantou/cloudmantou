# CloudMantou 服务器部署

## 环境要求

- Node.js 22 或更高版本
- MySQL 与 Redis 已启动
- Nginx/宝塔反向代理到应用监听端口
- 生产配置以项目根目录 `.env` 单独上传，文件权限设置为 `600`

## Git 拉取后启动

首次拉取主分支：

```bash
git clone -b main git@github.com:cloudmantou/cloudmantou.git
cd cloudmantou
```

更新已有目录：

```bash
git switch main
git pull --ff-only origin main
```

上传 `.env` 到项目根目录后执行：

```bash
chmod 600 .env
corepack enable
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm run content:mantou-article
pnpm run build
pnpm run start
```

使用 npm 启动时也可执行：

```bash
npm run build
npm run start
```

`pnpm run build` 会先按当前 `prisma/schema.prisma` 重新生成 Prisma Client，
再把 `.next/static` 与 `public` 自动整理进 standalone 目录。因此新增数据库字段后，
直接执行构建也不会继续使用旧的 Prisma 类型。`pnpm run start` / `npm run start` 会读取根目录 `.env`，然后通过
Node.js 运行 `.next/standalone/server.js`。

启动命令是前台进程。在宝塔 Node 项目中将启动命令配置为
`npm run start`，由宝塔负责进程守护和异常重启。

## 首次初始化

生产数据库首次部署并完成迁移后执行：

```bash
pnpm prisma db seed
```

生产环境需要在 `.env` 中设置 `SEED_ADMIN_PASSWORD`。

`pnpm run content:mantou-article` 会幂等创建或更新首页置顶的馒头助手产品文章；
已有管理员账号后，每次发布均可重复执行，使数据库正文与 Git 内容保持一致。

## 反向代理

应用通过 `.env` 中的 `HOSTNAME` 与 `PORT` 监听本机地址。Nginx 应传递：

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `Authorization`

`AUTH_URL`、`SITE_URL`、`NEXT_PUBLIC_SITE_URL` 应设置为正式公网域名，
`INTERNAL_SITE_URL` 设置为本机应用地址。

## 订单维护任务

至少每分钟调用一次订单维护接口：

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://cloudmantoua.top/api/cron/expire-orders
```

## 上传目录

`.env` 的 `UPLOAD_DIR` 应指向项目发布目录之外的持久化目录，避免 Git 更新
或重新构建时覆盖已上传文件。

宝塔裸机部署示例：

```env
UPLOAD_DIR="/www/wwwroot/cloudmantou-data/uploads"
UPLOAD_ALLOWED_ROOT="/www/wwwroot/cloudmantou-data"
```

创建目录后让运行 Node 的用户拥有写权限，并在站点 Nginx 配置中直接提供上传文件：

```nginx
location ^~ /uploads/ {
    alias /www/wwwroot/cloudmantou-data/uploads/;
    autoindex off;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

文章图片会在服务端校验后统一压缩为 WebP。远程图片按压缩结果的内容哈希
去重，不写入 Git；备份站点时需同时备份该持久化目录。

## AI 编辑助手

文章编辑器已通过 Vercel AI SDK 接入 Anthropic-compatible 与
OpenAI-compatible 两类 Provider，第一阶段提供结构化的 5 个标题候选与文章摘要。
生成结果只作为建议，管理员点击应用后才会写入当前编辑表单，发布流程保持原有
确认步骤。

MiniMax-M3 服务端配置：

```env
AI_ENABLED="true"
AI_PROVIDER_TYPE="anthropic-compatible"
AI_PROVIDER_NAME="minimax"
AI_BASE_URL="https://api.minimaxi.com/anthropic"
AI_API_KEY="replace-with-server-side-api-key"
AI_TEXT_MODEL="MiniMax-M3"
AI_ANTHROPIC_AUTH_MODE="auth-token"
AI_REQUEST_TIMEOUT_MS="120000"
AI_SUPPORTS_STRUCTURED_OUTPUTS="true"
```

Provider 会把 MiniMax 的基础地址规范化为 Vercel Anthropic Provider 所需的
`https://api.minimaxi.com/anthropic/v1`，实际请求发送到 `/messages`。

也可以使用 MiniMax/Claude Code 风格变量；项目专用的 `AI_*` 配置优先级更高：

```env
ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
ANTHROPIC_AUTH_TOKEN="replace-with-server-side-api-key"
ANTHROPIC_MODEL="MiniMax-M3"
```

若通过本机 CC Switch 等 OpenAI-compatible 代理：

```env
AI_PROVIDER_TYPE="openai-compatible"
AI_BASE_URL="http://127.0.0.1:15721/v1"
```

- `AI_API_KEY` 仅由 Node.js 服务端读取，前端响应和日志均不包含密钥。
- `AI_REQUEST_TIMEOUT_MS` 范围为 5000 至 300000；Claude Code 的
  `API_TIMEOUT_MS`、模型别名和流量开关不会进入网站运行时。
- 宝塔进程若继承了其他 `ANTHROPIC_*` 变量，使用 `AI_BASE_URL`、`AI_API_KEY`、
  `AI_TEXT_MODEL` 与 `AI_ANTHROPIC_AUTH_MODE` 可明确覆盖。
- 远程 Provider 地址必须使用 HTTPS；HTTP 只接受本机回环地址。
- 接口要求管理员登录并记录审计事件，每位管理员每 10 分钟最多生成 20 次。
- 编辑助手只接收标题、摘要和公开正文，付费章节不进入 AI 请求。
- 修改 AI 环境变量后重新构建并启动应用。
