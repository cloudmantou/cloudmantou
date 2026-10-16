# CloudMantou

基于 Next.js、React、Prisma 和 MySQL 的博客，包含文章管理、会员与卡密、支付、文章 IPA 下载，以及用户反馈和积分兑换。

## 本地开发

使用 Node.js 22 及以上版本、pnpm 11.7.0，并准备独立的开发 MySQL 数据库。IPA 元数据检查需要 Python 3。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# 在 .env 中填写开发数据库地址，并生成独立的随机密钥。
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

可选的开发数据初始化：`pnpm exec prisma db seed`。不要对已有生产数据库执行开发 seed。

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
```

## 已上线功能

- [文章 IPA 上传、更新说明、版本历史和权限下载](docs/article-ipa-management.md)
- [文章问题与 Bug 反馈、截图、开发进度、贡献积分与卡密兑换](docs/feedback-points.md)
- 支付宝正式支付配置由后台管理，网关密钥使用 `SETTINGS_ENCRYPTION_KEY` 加密保存在数据库中。

## 代码同步与部署

代码仓库：[cloudmantou/cloudmantou](https://github.com/cloudmantou/cloudmantou)。2026-10-16 的同步收录了服务器正在运行的 `feedback-points-20261010` 版本源码；后续代码修改应先在本地提交并推送，再构建、迁移和部署。

GitHub Actions 执行质量检查，不会自动修改生产服务器。本地推送代码与部署网站是两个独立步骤。

生产环境使用持久目录保存图片、IPA 和反馈截图；发布目录只放代码与构建结果。生产部署前备份数据库和密钥，执行 `pnpm exec prisma migrate deploy`，再使用 `pnpm build` 生成 standalone 产物，由现有进程管理器启动 `pnpm start`。生产反代的上传限制与私有下载缓存设置见功能文档。

`.env`、支付私钥、数据库备份、用户上传文件、IPA 和反馈截图不进入 Git。备份或迁移网站时，还须单独保存数据库、持久文件目录以及原来的 `AUTH_SECRET`、`SETTINGS_ENCRYPTION_KEY`、`CARD_SECRET_SALT`、`CARD_DELIVERY_KEY`（如配置）和 `POINT_CARD_KEY`；重新生成密钥不能恢复旧密文。
