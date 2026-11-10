# 小西记账官网迁移到 cloudmantou

## 范围

复用已部署的 cloudmantou 博客原生文章模板，发布产品、隐私、支持三个页面；不另起一套博客，不替换现有支付、订单、反馈服务或数据库。

- `/post/xiaoxi-jizhang`
- `/post/xiaoxi-jizhang-privacy`
- `/post/xiaoxi-jizhang-support`

源内容在 `src/content/xiaoxi-jizhang/`，英文译文在其 `en/` 子目录。1.1.0 尚未正式发布，文案明确区分功能介绍与商店当前可下载版本。

## 发布

本机 cloudmantou 主工作区有大量其他任务改动，因此这批内容在独立 worktree 准备。服务器以实际 `current` release 为准，只复制本次中英文 JSON 和发布脚本，不从这个历史 Git 基线覆盖整站代码。

先执行 `node scripts/publish-xiaoxi-jizhang.mjs` 检查内容。服务器在现有 release 中使用其现有私密配置和 Prisma Client：

```
node --env-file=.env scripts/publish-xiaoxi-jizhang.mjs --publish --backup-dir=/root/cloudmantou-deploy-backups/xiaoxi-site-20261110
```

脚本只处理三个明确 slug，事务更新三篇正文及对应的 en-US 译文，使用现有来源哈希规则，保留文章 ID、评论、反馈、浏览量和已存在的发布时间；拒绝覆盖付费文章及同 slug 的其他产品。执行前保存这三个页面及其翻译的原值，权限为 0600。不运行数据库迁移、不修改环境配置、不删除其他文章。

验证三个 URL 的 HTTPS 200、正文、标题、互相链接及无需登录阅读后，再更新 App Store Connect 的营销、技术支持和隐私政策地址。

## 旧入口退役

旧 `xx.cloudmantoua.top` 的 `/`、`/marketing`、`/privacy` 和 `/support` 改为 301 跳转到对应博客页面，含尾斜杠兼容。先备份旧 Nginx 配置与静态内容，执行 `nginx -t` 后原子替换并 reload；不变更其他 API 路由，不删除账本或后台数据。旧正文退出公开服务，备份保留用于回滚。

## 回滚

页面发布可恢复备份中的目标文章字段。新建文章先下线为 DRAFT，避免删除后来新增的评论和反馈。旧入口回滚使用原 Nginx 配置并验证语法后 reload，不恢复整库覆盖新订单。

## 当前状态

已于 2026-11-10 发布：

- 以 Ubuntu 账户和已有 SSH 密钥连接，使用现有 sudo 权限；未使用或保存聊天中的密码。
- 保留 current 指向 `releases/testflight-benefits-20261109`，未重建或替换现有应用服务。
- 事务发布三个目标 slug 及 en-US 译文；首次验证发现英文浏览器重定向后无译文，补齐后重新验证通过。
- 中文及英文浏览器请求共 6 个页面均为 HTTPS 200，标题与正文正确，无需登录。英文会使用博客现有的 `/en/post/...` 路由。
- 原 `/`、`/marketing`、`/privacy`、`/support` 及相应尾斜杠路由返回 301，指向对应博客文章。旧正文已退出这些公开入口；原文件保存在私密回滚备份中。
- Nginx 修改位置为 `node_backend.conf`，只增加上述精确 location。语法检查通过并 reload。已有的 cloudmantou 80 端口重名 warning 仍存在，本次未修改其他站点配置。
- cloudmantou 首页及兑换页、旧后端 `/health` 返回 200。其他支付/交易未进行真实操作。
- App Store Connect 1.1.0 的营销、技术支持及隐私政策 URL 已替换并保存；构建为 8。
- 私密备份目录 `/root/cloudmantou-deploy-backups/xiaoxi-site-20261110`，包含目标文章/译文原值、原 Nginx 配置、旧静态页面压缩包。未下载服务器环境文件或密钥。

旧页面通过精确 301 退役，未删除后端程序及数据。后端配置更新 API 继续工作，以保留既有客户端兼容性。
