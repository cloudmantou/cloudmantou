# CloudMantou 项目全面审计报告

> 审计时间：2026-07-02 | 覆盖范围：安全、架构、性能、代码质量、数据完整性

---

## 总览

| 维度 | 评级 | 说明 |
|------|------|------|
| 安全 | ⚠️ C | 认证基础扎实，但缺速率限制、弱密钥、多处类型绕过 |
| 数据完整性 | ⚠️ C+ | VIP 过期时间未写入、PAID_POST 永不过期等业务级 bug |
| 代码质量 | ⚠️ B- | strict TS 配置被 50+ `as any` 削弱，catch 块类型不严谨 |
| 测试 | ❌ D | 仅 20 个单元测试，0 组件测试，覆盖 44% |
| 架构 | ✅ B | 分层清晰，API/组件/工具职责分明，少量重复代码 |
| 运维 | ⚠️ B | Dockerfile 缺 migrate deploy，安全头未配置 |

---

## P0 · 关键问题（建议立即修复）

### 1. `requireAdmin()` 放在 try 块外部 → 未捕获异常
**文件**: `src/app/api/admin/posts/route.ts` 第 24 行

```typescript
export async function GET(req: NextRequest) {
  await requireAdmin();  // ← 在 try 块外部调用！
  try {
```

如果 `requireAdmin()` 抛出 `ApiError`（401/403），它不会被下面的 `catch` 捕获，用户收到 Next.js 默认 500 而非正确的错误码。

**同样问题**：`src/app/api/admin/cards/route.ts:23`、`src/app/api/admin/categories/route.ts:15`、`src/app/api/admin/comments/route.ts:14`、`src/app/api/admin/tags/route.ts:14`、`src/app/api/admin/orders/route.ts:15`、`src/app/api/admin/stats/route.ts:9`。

**修复**: 将 `await requireAdmin()` 移入 try 块第一行。

---

### 2. 参数化 `[id]` 路由中 `requireAdmin()` 未被调用
**影响文件**（6 个）：

| 文件 | 问题 |
|------|------|
| `src/app/api/admin/cards/[id]/route.ts` | 导入但 PUT 处理器未调用 |
| `src/app/api/admin/categories/[id]/route.ts` | 导入但 PUT+DELETE 未调用 |
| `src/app/api/admin/posts/[id]/route.ts` | 导入但 GET+PUT+DELETE 未调用 |
| `src/app/api/admin/comments/[id]/route.ts` | 导入但 PUT+DELETE 未调用 |
| `src/app/api/admin/tags/[id]/route.ts` | 导入但 PUT+DELETE 未调用 |
| `src/app/api/admin/stats/route.ts` | **根本未导入**，完全无认证 |

如果中间件被误配或绕过，这些路由将毫无保护。每个处理器入口第一行需添加 `await requireAdmin()`。

---

### 3. 微信 V3 支付密钥 base64 解码错误
**文件**: `src/app/api/payment/notify/wechat/route.ts` 第 202 行

```typescript
const decipher = crypto.createDecipheriv(
  "aes-256-gcm",
  Buffer.from(apiKey, "utf8"),    // ❌ 应该用 "base64"
  Buffer.from(nonce, "utf8")
);
```

微信支付 V3 的 APIv3 密钥是 32 字节 base64 编码的随机密钥。当前使用 UTF-8 解码会导致解密失败，**所有微信 V3 支付通知都无法正确处理**。

**修复**: 将 `Buffer.from(apiKey, "utf8")` 改为 `Buffer.from(apiKey, "base64")`。

---

### 4. 弱 AUTH_SECRET + 硬编码卡密盐值

| 文件 | 问题 |
|------|------|
| `.env` / `.env.local` 第 5 行 | `AUTH_SECRET="starblog-a7k9m2x4p8w6e3r1t5y0u3i7o9p2l4k6"` 是手动输入的键盘模式串，熵值极低 |
| `src/lib/card-crypto.ts` 第 3 行 | `CARD_SECRET_SALT \|\| "cloudmantou-card-salt-2026"` 硬编码 fallback |

**修复**:
```bash
# 生成安全的 AUTH_SECRET
openssl rand -base64 32

# card-crypto.ts — 去掉默认值，缺失时直接抛错
const CARD_SECRET_SALT = process.env.CARD_SECRET_SALT;
if (!CARD_SECRET_SALT) throw new Error("CARD_SECRET_SALT is required");
```

---

### 5. 支付 VIP 后 `vipExpireAt` 未写入用户表
**文件**: `src/lib/payment.ts` 第 115-150 行

`grantEntitlement()` 处理 VIP 购买时只设置 `vipLevel`，但**从未写入 `vipExpireAt`**。支付购买的 VIP 用户在数据库中无过期时间记录，权益判断可能出错。

卡密兑换流程（`cards/verify/route.ts` 第 87-93 行）正确设置了两者，支付流程应统一。

---

### 6. PAID_POST 权益永不过期
**文件**: `src/lib/post-access.ts` 第 63-70 行

```typescript
// VIP 检查有 expiresAt 过滤 ✅
// PAID_POST 检查完全没有 expiresAt ❌
```

一次购买永久访问，与付费订阅模型矛盾。建议添加 `expiresAt: { gte: new Date() }` 条件。

---

### 7. `BlogPost.content` 类型不一致
**文件**: `src/types/index.ts` 第 23 行 vs API 实际返回

- 类型定义: `content: string[]`（段落数组，用于 mock 数据）
- API 实际返回: `content: string`（Markdown 字符串）
- `MarkdownRenderer` 接收: `content: string`

类型与实际数据不匹配，应在类型层面统一为 `string` 或将 mock 数据适配。

---

## P1 · 高优先级（建议本周修复）

### 8. 无速率限制
**影响面**: 全项目

登录、注册、点赞、评论、卡密验证、所有管理端 API 均无限速。面临暴力破解、批量注册、评论 spam、DDoS 等风险。

Redis 已在 docker-compose 中配置（`REDIS_URL` 环境变量已设置），可直接使用 `@upstash/ratelimit` 或基于 Redis 的自定义限流。

---

### 9. 卡密哈希使用 SHA-256 而非慢哈希
**文件**: `src/lib/card-crypto.ts` 第 9-12 行

```typescript
return crypto.createHash("sha256").update(secret + CARD_SECRET_SALT).digest("hex");
```

SHA-256 计算速度极快，易受暴力破解和彩虹表攻击。应改用 bcrypt（与密码哈希一致）。

---

### 10. 缺少安全头配置
**文件**: `next.config.mjs`

未配置 Content-Security-Policy、Strict-Transport-Security、X-Content-Type-Options、X-Frame-Options、Referrer-Policy 等关键安全头。

---

### 11. `card-redemption.ts` 遗留代码含明文比较
**文件**: `src/lib/card-redemption.ts` 第 31 行

```typescript
const card = cards.find(
  (item) => item.cardNo === input.cardNo && item.cardSecret === input.cardSecret
);
```

此文件未被实际 API 使用（API 用哈希比较），但其存在本身是风险——未来开发者可能误用导致明文卡密泄露。建议删除或用 JSDoc 标注为废弃代码。

---

### 12. VIP 续费逻辑缺失
**文件**: `src/lib/payment.ts` 第 115-150 行

每次购买 VIP 创建独立权益，不检查现有权益到期时间并叠加。卡密兑换（`cards/verify/route.ts` 第 80-85 行）正确处理了续费延期，支付流程应统一。

---

### 13. 数据库公网暴露 + 弱密码
**文件**: `.env` 第 2 行

```
DATABASE_URL="mysql://cloudmantoua:cloudmantoua@124.221.8.124:3306/cloudmantoua"
```

- 数据库暴露在公网 IP
- 用户名和密码相同（`cloudmantoua`）
- `docker-compose.yml` 也暴露 3306 端口

建议使用内网地址、强密码、或通过 SSH 隧道连接。

---

### 14. 种子数据弱密码
**文件**: `prisma/seed.ts` 第 66、80 行

```typescript
const adminPassword = await bcrypt.hash("admin123", 12);
const userPassword = await bcrypt.hash("user123", 12);
```

---

### 15. 50+ 处 `as any` 类型断言
**影响文件**: `auth.ts`、`guards.ts`、`middleware.ts`、`dashboard/page.tsx`、6+ API 路由

`tsconfig.json` 已设置 `strict: true`，但大量 `as any` 绕过了类型检查。核心问题是 NextAuth session 类型扩展不完整。

**建议**: 完善 `src/types/next-auth.d.ts` 的类型扩展，让 TypeScript 正确识别 `user.role` 和 `user.id`，然后移除所有 `as any`。

---

### 16. 评论自动审核通过（无垃圾过滤）
**文件**: `src/app/api/posts/[slug]/comments/route.ts` 第 146 行

```typescript
status: "APPROVED",  // 无审核、无垃圾过滤，评论直接发布
```

建议开发环境设为 `APPROVED` 便于测试，生产环境默认 `PENDING` 待审核。

---

## P2 · 中优先级（建议迭代修复）

### 代码质量

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 17 | GET 查询参数缺 Zod 验证 | `posts/route.ts:18-23`、`admin/orders/route.ts:13` 等 8 个路由 | 为查询参数添加 Zod schema |
| 18 | 组件缺 loading/error 状态 | `PlatformShell.tsx:81,97`、`CategoryNav.tsx:28` | 引入 useSWR 或添加骨架屏 |
| 19 | 纯展示组件未用 `React.memo` | `AccentTag`、`MetricCard`、`ProductCard`、`PostMeta` | 添加 memo 减少无意义重渲染 |
| 20 | `PlatformShell` 中 apiPosts→BlogPost 转换未 memo | `PlatformShell.tsx:329-350` | 用 `useMemo` 缓存 |
| 21 | `estimateReadTime` 函数重复定义 | `PostMeta.tsx:103` + `phase3-apis.test.ts:37` | 提取到 `src/lib/utils.ts` |
| 22 | 支付回调 15 行业务代码重复 | alipay/wechat notify 路由 | 提取公共事务函数 |

### 架构与样式

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 23 | `globals.css` 单体 1959 行 | `src/app/globals.css` | 按组件域拆分或引入 Tailwind |
| 24 | 组件大量使用内联 `style={{…}}` | `PostEditor.tsx`、`PlatformShell.tsx` 等 | 迁移到 CSS 类 |
| 25 | `next/image` 未配置 `remotePatterns` | `CommentItem.tsx:59` 使用外部 URL | 在 `next.config.mjs` 中配置 |
| 26 | 未使用 EDITOR 角色 | `prisma/schema.prisma:237` | 实现或移除 |
| 27 | `Dockerfile` 缺 `prisma migrate deploy` | `Dockerfile:37` | 添加 entrypoint 脚本 |

### 数据库

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 28 | 多个高频查询列缺索引 | `schema.prisma` 中 `role`、`vipExpireAt`、`parentId` 等 8 列 | 添加 `@@index` |
| 29 | 冗余索引 | `Order.orderNo` + `Card.cardNo` 同时有 `@unique` 和 `@@index` | 删除 `@@index` |
| 30 | `Card.usedBy`、`Order.userId` 缺 `onDelete` | `schema.prisma:169,213` | 添加 `onDelete: SetNull` / `Restrict` |
| 31 | Category/Tag/Comment 缺 `updatedAt` | `schema.prisma:98,111,134` | 添加 `updatedAt DateTime @updatedAt` |

### 测试

| # | 问题 | 建议 |
|---|------|------|
| 32 | 0 个组件测试 | 安装 `@testing-library/react` + `jsdom`，为核心交互组件编写冒烟测试 |
| 33 | `card-crypto.ts`、`guards.ts`、`payment.ts` 未测试 | 为支付签名验证、权限守卫、卡密哈希添加测试 |
| 34 | 测试覆盖率 44%（目标 80%） | vitest.config.ts 中 `coverage.include` 仅覆盖 `src/lib/**`，扩展到组件和页面 |

### 运维

| # | 问题 | 建议 |
|---|------|------|
| 35 | `next-auth` 使用 beta.31 版本 | 检查是否有稳定版或更新的 beta |
| 36 | 无 pre-commit hooks | 添加 husky + lint-staged |
| 37 | 缺少 `viewport` export 和 `theme-color` meta | 在 `layout.tsx` 中补充 |
| 38 | `User.balance: Int`（分） vs `PaidContent.price: Decimal(10,2)`（元） | 统一金额单位 |

---

## 已确认安全的方面 ✅

以下方面在审计中未发现问题，值得肯定：

- **Prisma 参数化查询** — 无 SQL 注入风险（唯一 `$executeRaw` 使用标记模板语法）
- **支付宝支付通知** — 10 步验证流程完整，含签名验证、幂等处理、金额校验、事务更新
- **密码哈希** — 使用 bcrypt 12 轮，符合标准
- **中间件路由保护** — `/admin`、`/dashboard`、写入 API 路径均有认证控制
- **TypeScript strict mode** — 已启用，只是被 `as any` 削弱
- **Docker 多阶段构建** — `output: "standalone"` 已正确配置
- **种子数据幂等** — 全量使用 `upsert`
- **CSS 变量主题设计** — 深浅色模式通过 `prefers-color-scheme` 完整覆盖

---

## 修复建议优先级路线图

```
第 1 周 (P0)
├── 修复 requireAdmin() try/catch 位置（6 个文件）
├── 补充参数化路由 requireAdmin() 调用（6 个文件）
├── 修复微信 V3 API 密钥 base64 解码
├── 重新生成 AUTH_SECRET + 移除 card-crypto 硬编码 fallback
├── 修复 VIP 支付后 vipExpireAt 写入
└── 修复 PAID_POST 权益过期检查

第 2 周 (P1)
├── 添加速率限制（登录/注册/评论/卡密验证）
├── 卡密哈希迁移到 bcrypt
├── 配置安全响应头
├── 处理 card-redemption.ts 遗留代码
├── 统一 VIP 续费逻辑
├── 数据库安全加固（内网/强密码）
└── 完善 NextAuth 类型扩展 + 移除 as any

第 3 周+
├── 查询参数 Zod 验证
├── 组件 loading/error 状态
├── React.memo 优化
├── 数据库索引补全
├── 组件测试基础设施
└── 代码重复消除
```
