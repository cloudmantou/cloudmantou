# 红笺墨语 App Store 配套页面

| 页面 | 路径 | App Store Connect 字段 |
| --- | --- | --- |
| 产品介绍 | `/apps/hongjian-moyu` | 营销网址（可选） |
| 技术支持 | `/apps/hongjian-moyu/support` | 技术支持网址（必填） |
| 隐私政策 | `/apps/hongjian-moyu/privacy` | 隐私政策网址（必填） |
| 用户协议 | `/apps/hongjian-moyu/terms` | 可在 App 描述或 App 内引用 |

- 文案集中在 `src/config/hongjian-app.ts`，外壳是 `src/components/hongjian/HongjianAppPage.tsx`，样式在 `src/styles/hongjian-app.css`。
- 页面刻意不复用博客 / 官网外壳：审核人员会打开这些链接，页面里不能出现站点导航、会员卡密、IPA 下载或侧载相关内容。`tests/hongjian-app-pages.test.ts` 会拦截这些词。
- 路由不在 `OFFICIAL_PUBLIC_ROOTS` 里，不会被重定向到 `/en/...`；每页末尾附英文摘要。

## 部署注意：旧的 nginx 静态隐私页

2026-10-09 起，生产 nginx 用 `location = /apps/hongjian-moyu/privacy` 直接返回静态文件
`/www/wwwroot/cloudmantoua.top/app/shared/public-policies/hongjian-moyu-privacy.html`（片段 `shared/nginx/hongjian-moyu-privacy.conf`，HTTP 和 HTTPS 两个 vhost 都 include 了它）。
精确匹配优先，**会盖住**本分支的 Next 版隐私页（v1.1，新增「官方听书模型」/ 小米 MiMo 说明）。

上线本分支后，二选一：

1. 推荐：从两个 vhost 中去掉该 include，`nginx -t` 后重载，让 Next 页面接管；
2. 或者用本页渲染结果替换那份静态 HTML。

上线后用 `curl -sI https://cloudmantoua.top/apps/hongjian-moyu/{,support,privacy,terms}` 确认四个地址都是 200，并确认隐私页里有「小米 MiMo」。
