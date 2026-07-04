# CloudMantou v0.2.5

**发布日期：** 2026-07-05  
**Git Tag：** `v0.2.5`  
**构建验证：** `pnpm test` 110/110 · `pnpm build` 通过（Next.js 16.2.10 standalone）

---

## 本版本亮点

### 前台体验
- 侧边栏联系方式可在后台配置（公众号 / 微信 / Telegram / 邮箱 / GitHub / 自定义）
- 支持自定义图标与二维码弹层
- 邮箱图标点击自动复制地址
- Workspace 仅保留「登录」，底部联系方式常驻显示
- 登录成功后 session 即时同步，无需手动刷新页面

### 安全与基础设施
- CSP nonce + `strict-dynamic`（生产环境）
- Auth 配置拆分为 edge-safe `auth.config.ts`
- 登录 Redis 限流（服务端 authorize）
- 支付网关密钥 AES-256-GCM 加密存储
- Next.js 升级至 **16.2.10**
- 根级 `error.tsx` 错误边界

### 构建与运维
- 密钥环境变量改为**运行时**校验，`next build` 不再因缺少 `.env` 失败
- Docker entrypoint 自动执行 `prisma migrate deploy`
- Standalone 产物已验证（`server.js` + static）

---

## 升级说明（从 v0.2.2 及更早版本）

1. 拉取代码并切换到 tag：`git fetch --tags && git checkout v0.2.5`
2. 确认 `.env` 已配置必填项（见下方）
3. 执行数据库迁移：`npx prisma migrate deploy`
4. 重新构建并重启应用

> **注意：** 若此前未设置 `SETTINGS_ENCRYPTION_KEY`，需在后台重新保存支付网关配置（密钥会以新 key 加密）。

---

## 生产环境必填 `.env`

```env
DATABASE_URL=mysql://user:pass@host:3306/cloudmantou
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://your-domain.com
SITE_URL=https://your-domain.com
CARD_SECRET_SALT=<openssl rand -hex 32>
SETTINGS_ENCRYPTION_KEY=<openssl rand -hex 32>
TRUST_PROXY_HEADERS=true
REDIS_URL=redis://127.0.0.1:6379
```

可选：`CRON_SECRET`、`PAYMENT_TEST_MODE`、`ALIPAY_*`、`WECHAT_*`

---

## 部署方式

### 方式 A：裸机 / PM2（推荐已有 Node 环境）

```bash
cd /path/to/cloudmantou
git fetch --tags && git checkout v0.2.5
bash scripts/deploy-standalone.sh
```

### 方式 B：Docker Compose

```bash
git fetch --tags && git checkout v0.2.5
cp .env.example .env   # 首次部署
# 编辑 .env 填入生产密钥
docker compose up -d --build
docker compose exec app npx prisma db seed   # 仅首次
```

---

## 部署后检查清单

- [ ] 首页、博客、会员中心可访问
- [ ] 登录后侧边栏显示用户信息与「退出」
- [ ] 后台 `/admin` 可登录
- [ ] 联系方式图标与二维码正常
- [ ] 支付回调 URL 与 `SITE_URL` 一致
- [ ] 上传目录 `public/uploads` 可写且已持久化

---

## 已知限制

- Next.js 16 `middleware` → `proxy` 迁移警告（不影响运行）
- 卡密套餐在线购买尚未开放
- Stripe / USDT / 易支付仅预留字段