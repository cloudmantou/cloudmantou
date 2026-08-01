# 馒头助手 · 官网版设计方案

> 分支：`official-site`（自 `main` 分出）  
> 定位：AppFlex = 馒头助手，同一产品的**产品官网**，与博客版 `main` 长期并存  
> 日期：2026-07-05

---

## 1. 核心判断：左侧导航为什么不合理

| 维度 | 博客版（当前） | 官网版（目标） |
|------|----------------|----------------|
| 用户心智 | 「我在逛一个人的站点」 | 「我在了解/下载一款工具」 |
| 浏览路径 | 多栏目切换（博客/商店/日常） | 单页纵向叙事：价值 → 功能 → 商店 → 定价 → 行动 |
| 转化目标 | 阅读、订阅、偶尔购卡 | **安装 App、开通会员、进入应用商店** |
| 移动端 | 侧栏挤占内容区 | 顶栏 + 全宽 Hero，行业标准 |
| SEO | 单 URL `/?section=blog` 不利于收录 | 独立 URL `/store`、`/download` 各有关键词 |

**结论：** 官网版废弃面向公众的 `PlatformSidebar`，改为 **顶部固定导航 + 全宽内容区 + 页脚**。侧栏仅保留在 `/admin` 后台。

参考站型：产品落地页（Linear、Raycast）+ 应用分发页（ipa 商店类），而非子比主题式资讯站。

---

## 2. 品牌与信息架构

### 2.1 品牌统一

- **对外主品牌：** 馒头助手  
- **别名/历史名：** AppFlex（全站文案、SEO、结构化数据中做 `alternateName`）  
- **一句话：** iOS 应用安装与增强工具，内置应用商店，支持香色闺阁、源阅读等。  
- **副标题示例：** 虚拟定位 · 应用商店 · 无需越狱

### 2.2 站点地图（官网版）

```
/                     首页（Landing）
├── /download         安装与激活（巨魔 / 教程 / 系统要求）
├── /store            应用商店（香色闺阁、源阅读、分类浏览）
│   └── /store/[slug] 单个应用详情 + 安装指引
├── /features         功能详解（虚拟定位、多开、插件…）
├── /pricing          会员与卡密（复用支付链路）
├── /docs             使用教程（可聚合原博客「教程」类文章）
├── /blog             技术博客（降级为次要入口，保 SEO 长尾）
├── /dashboard        会员中心（保留）
├── /login /register  认证（保留）
└── /admin            后台（保留并扩展「应用目录」管理）
```

### 2.3 顶部导航结构

```
[馒头助手 Logo]     功能  应用商店  安装  定价  教程  博客     [下载] [登录/头像]
                     ↑ 锚点或独立页              ↑ 次要      ↑ 主 CTA 渐变按钮
```

移动端：汉堡菜单收纳次要项，「立即下载」始终可见。

### 2.4 中英文与系统要求（已实施）

- 中文使用现有无前缀地址（例如 `/features`），英文使用独立 `/en` 地址（例如 `/en/features`）。
- 首次访问按浏览器 `Accept-Language` 自动识别；用户手动切换后以 `cloudmantou_locale` Cookie 记住选择。
- URL 中显式的 `/en` 优先级最高；API、后台、会员中心、维护页和支付回调不参与语言重写。
- 服务端 HTML、`lang`、页面文案、canonical、`hreflang`、Open Graph 与 JSON-LD 使用同一语言结果，避免首屏闪烁。
- 中文 canonical 兼作 `x-default`；sitemap 同时列出已经完成翻译的中英文官网静态页面。
- 最低系统统一为 **iOS 15.0 及以上**；虚拟定位支持 iOS 15 及以上，新系统适配说明仍为 iOS 26.4 及以上。
- `StoreApp`、商品和博客正文属于后台录入内容，当前按原文展示；若需要逐条英文内容，后续应增加显式翻译字段与审核流程。

---

## 3. 页面线框（逐页）

### 3.1 首页 `/`

```
┌─────────────────────────────────────────────────────────────┐
│  [顶栏]                                                      │
├─────────────────────────────────────────────────────────────┤
│  HERO                                                        │
│  · 大标题：馒头助手 — 你的 iOS 应用安装专家                    │
│  · 副文案 + 双 CTA：[免费了解安装] [查看应用商店]              │
│  · 右侧：iPhone Mockup 轮播（商店截图 / 虚拟定位 / 安装流程）  │
│  · 信任条：已服务 x 用户 · 支持 iOS 15.0+ · AppFlex 同款      │
├─────────────────────────────────────────────────────────────┤
│  核心功能（3–4 列图标卡）                                      │
│  · 应用商店  · 虚拟定位  · 一键安装  · 会员权益                │
├─────────────────────────────────────────────────────────────┤
│  精选应用（横向滚动）                                          │
│  [香色闺阁] [源阅读] [更多…]  → 进入 /store                    │
├─────────────────────────────────────────────────────────────┤
│  安装三步（图示）                                              │
│  购卡 → 安装馒头助手 → 商店内下载应用                           │
├─────────────────────────────────────────────────────────────┤
│  定价预览（月卡/年卡）→ /pricing                               │
├─────────────────────────────────────────────────────────────┤
│  FAQ（折叠）+ 联系方式                                         │
├─────────────────────────────────────────────────────────────┤
│  [页脚] 链接 · 备案 · 社交 · AppFlex 说明                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 应用商店 `/store`

- **布局：** 顶栏筛选（全部 / 阅读 / 工具 / 娱乐）+ 搜索框 + 应用卡片网格  
- **卡片信息：** 图标、名称、简介、标签（如「阅读」「热门」）、会员标识  
- **重点应用：** 香色闺阁、源阅读置顶 `featured` 位  
- **权限：** 未登录可浏览；下载/安装链接受会员或有效卡密保护（复用现有 entitlement）  
- **详情页 `/store/[slug]`：** 截图画廊、版本说明、安装步骤、相关教程链接

### 3.3 安装页 `/download`

- 系统要求（iOS 版本、设备）  
- 安装方式分 Tab：巨魔商店 / 其他侧载方式（按实际支持情况写）  
- 卡密激活流程（对接现有 `/pricing` 购卡）  
- 视频或 GIF 分步指引  

### 3.4 定价页 `/pricing`

- 复用现有 `ProductCard`、支付、卡密逻辑  
- 文案从「会员内容」改为「馒头助手会员 · 商店全应用下载」  
- 突出：30 天有效、无限次下载（与现网 cloudmantoua.top 卡密描述一致）

---

## 4. 视觉与交互方向

### 4.1 设计语言

- **基调：** 深色为主（`#0a0a0f` 背景）+ 暖色点缀（馒头品牌色：琥珀/麦黄 `#f5a623` 或珊瑚橙）  
- **风格：** Apple 式留白 + 轻玻璃拟态卡片，避免博客版「侧栏 + 多 section SPA」的仪表盘感  
- **字体：** 系统栈 `-apple-system, "PingFang SC"`，标题加粗、正文 16px 起  
- **图标：** Lucide 线性图标 + 应用真实图标（商店区）  
- **动效：** Hero 区 subtle 渐变流动；卡片 hover 微抬升；首屏不堆过重动画（利于 LCP）

### 4.2 与博客版的差异

| 元素 | 博客版 | 官网版 |
|------|--------|--------|
| 导航 | 左侧 `PlatformSidebar` | 顶部 `OfficialNavbar` |
| 首页 | `PlatformShell` 多 section | 独立 `OfficialHome` 落地页 |
| 背景 | `HomeBackdrop` 博客氛围 | 产品渐变 + 设备 Mockup |
| 主 CTA | 「会员与卡密」侧栏项 | 全局「下载 / 安装」按钮 |
| 内容重心 | 文章、日常记录 | 应用、功能、安装 |

### 4.3 组件规划（新增）

```
src/components/official/
  OfficialNavbar.tsx      # 顶栏
  OfficialFooter.tsx      # 页脚
  OfficialShell.tsx       # 官网页通用布局（顶栏+主内容+页脚）
  HeroSection.tsx
  FeatureGrid.tsx
  AppShowcase.tsx         # 精选应用横滑
  InstallSteps.tsx
  PricingPreview.tsx
  FaqSection.tsx
  StoreAppCard.tsx
  StoreFilterBar.tsx
  DeviceMockup.tsx        # 手机框 + 截图
```

`MarketingShell` / `PlatformSidebar`：**官网路由不再引用**，`main` 分支保持不动。

---

## 5. SEO 策略

### 5.1 关键词矩阵

| 优先级 | 目标词 | 落地页 |
|--------|--------|--------|
| P0 | 馒头助手、AppFlex | `/`、`layout` metadata |
| P0 | 馒头助手 iOS 安装、AppFlex 下载 | `/download` |
| P1 | 香色闺阁 安装、香色闺阁 iOS | `/store/xiangse` |
| P1 | 源阅读 安装、源阅读 iOS | `/store/yuandu` |
| P2 | iOS 虚拟定位、巨魔 应用商店 | `/features` |
| 长尾 | 教程类（5G-A 等） | `/blog`、`/docs` |

### 5.2 技术 SEO

- **每页独立 `generateMetadata`**，禁止仅靠 `/?section=` 传参  
- **JSON-LD：**
  - 全站 `WebSite` + `Organization`
  - 首页 `SoftwareApplication`（`name`, `alternateName: AppFlex`, `operatingSystem: iOS`, `offers`）
  - 商店应用页 `MobileApplication`
  - 教程文章保留 `BlogPosting`
- **`sitemap.ts`：** 提高 `/`、`/store/*`、`/download` priority（0.9–1.0），博客 0.6  
- **Open Graph：** 每页定制 `og:image`（1200×630，含产品名 + 截图）  
- **`robots.ts`：** 允许抓取商店与安装页；`/admin`、`/api` 禁止  
- **canonical：** 统一 HTTPS 主域名，AppFlex 旧链 301 到对应新路径（部署时配置）

### 5.3 内容 SEO

- 首页 H1 唯一且含「馒头助手」  
- 商店每个应用：独立 title/description，正文 300 字以上介绍  
- 博客保留但导航降级，用于教程长尾（与现 cloudmantoua.top 教程文章策略一致）  
- 内链：功能页 ↔ 商店 ↔ 安装页 ↔ 定价 形成闭环

---

## 6. 数据模型扩展（Prisma）

新增 `StoreApp` 表（或后台「应用目录」）：

```prisma
model StoreApp {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  tagline     String?
  description String   @db.Text
  iconUrl     String?
  coverUrl    String?
  screenshots Json?    // string[]
  category    StoreAppCategory @default(READING)
  featured    Boolean  @default(false)
  sortOrder   Int      @default(0)
  published   Boolean  @default(false)
  // 安装包或 plist 链接（会员可见）
  installUrl  String?  @db.Text
  minIos      String?  // e.g. "15.0"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum StoreAppCategory {
  READING
  TOOL
  ENTERTAINMENT
  OTHER
}
```

种子数据预置：香色闺阁、源阅读。  
权限：读取公开列表；`installUrl` 仅会员/有效卡密用户 API 返回。

---

## 7. 分支与代码策略

### 7.1 分支模型

```
main           → 博客版（CloudMantou 个人站），继续维护
official-site  → 官网版（馒头助手产品站），本设计文档所在分支
```

合并策略：**仅共享修复**（安全、支付、Prisma）cherry-pick 到两分支；前端大改不互相 merge。

### 7.2 配置分流（推荐）

`src/config/site.ts` 按环境变量切换：

```ts
export const SITE_MODE = process.env.NEXT_PUBLIC_SITE_MODE ?? "blog"; // "blog" | "official"
```

官网部署时：

```env
NEXT_PUBLIC_SITE_MODE=official
SITE_NAME=馒头助手
SITE_URL=https://cloudmantoua.top
```

本地开发博客版不设该变量即可。

### 7.3 实施阶段（PR 计划）

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P1** | `OfficialShell` + 顶栏/页脚 + 首页 Hero + `site.ts` 分流 | 2–3 天 |
| **P2** | `/download`、`/features` 静态页 + SEO metadata | 1–2 天 |
| **P3** | `StoreApp` 模型 + `/store` + 后台 CRUD | 3–4 天 |
| **P4** | `/pricing` 文案与布局改版，对接现有支付 | 1 天 |
| **P5** | JSON-LD、sitemap、OG 图、FAQ 结构化数据 | 1–2 天 |
| **P6** | 移动端适配、性能（LCP 图 preload）、无障碍 | 1–2 天 |

---

## 8. 部署与域名（已确认）

| 域名 | 用途 | 分支 |
|------|------|------|
| **cloudmantoua.top** | 馒头助手官网（主站） | `official-site` |
| **blog.cloudmantoua.top**（建议） | 技术博客 | `main` |

- 官网部署：`official-site` 分支构建，`SITE_URL=https://cloudmantoua.top`
- 博客部署：`main` 分支构建，`SITE_URL=https://blog.cloudmantoua.top`（DNS A/CNAME 指向同一服务器或独立实例均可）
- 支付回调、OAuth、`AUTH_URL` 与主站 `SITE_URL` 保持一致（`cloudmantoua.top`）
- 博客子域通过顶栏「博客」外链或 301 跳转接入，不占主域首页
- 基础设施与博客版相同：Docker Compose 或 PM2 standalone

---

## 9. 验收清单

- [x] 首页无左侧栏，顶栏导航正常（桌面 + 移动）
- [x] 「馒头助手」与「AppFlex」在 title、H1、JSON-LD 中同时出现
- [ ] `/store` 展示香色闺阁、源阅读且可进详情
- [ ] 购卡 → 登录 → 获取安装链路的闭环可跑通
- [ ] Lighthouse SEO ≥ 90（首页）
- [ ] 博客仍可通过 `/blog` 访问（可选）
- [ ] `main` 分支博客版不受影响

---

## 10. 待产品确认

1. 安装方式具体支持哪些（巨魔 only？是否含企业签？）  
2. 虚拟定位是否作为对外主打功能（涉及合规文案口径）  
3. ~~主域名最终落在官网还是博客~~ → **已确认：`cloudmantoua.top` = 官网**  
4. 商店内应用除香色闺阁、源阅读外，首发上架列表  
5. ~~是否需要中英文双语（影响导航与 metadata 结构）~~ → **已确认：按系统语言自动识别，中文无前缀，英文 `/en`**  
