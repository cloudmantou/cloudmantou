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
pnpm prisma generate
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

`pnpm run build` 会把 `.next/static` 与 `public` 自动整理进 standalone
目录。`pnpm run start` / `npm run start` 会读取根目录 `.env`，然后通过
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
