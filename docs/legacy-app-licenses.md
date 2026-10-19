# 原 Mantou Admin 的卡密与应用管理

本次整合范围是应用、授权卡密和设备绑定。Python 签名安装服务继续运行，已发布客户端继续使用旧协议。

## 已确认的源码及数据库

- 管理前端：Vue 3 / uni-app（`mantouadmin`，HBuilderX 项目）。
- Python 后端：FastAPI / PyMySQL，`app/main.py`，监听 9002。
- 另有 Node / Express 后端监听 6677，使用相同的 `ipa` MySQL 数据库（3306）。
- 本地原始源码保存在博客 Git 仓库之外的 `card-management-system/`：`mantouadmin/`、`python-backend-source/`、`node-backend-source/`。原始代码可能包含硬编码配置，只作私有迁移参考，不上传公开仓库。
- 迁移前快照：8 个应用、995 张卡密、400 条设备绑定。数量会随业务继续变化。

## 新后台

入口 `/admin/app-licenses`，使用博客管理员登录和审计系统。

| 功能 | 行为 |
| --- | --- |
| 应用 | 添加、编辑、删除、从 IPA 源同步、开关 `requires_key` |
| 授权卡密 | 分页搜索、状态筛选、批量生成、导入去重、下载本次新增卡密、删除（卡密严格一次性，已使用不可重置） |
| 设备 | 按卡密/UDID 搜索、用未使用卡密授权、解除绑定、勾选后批量解除（单次最多 100 条）、显示自动解除日期和剩余天数 |

新接口 `GET/POST /api/admin/app-licenses` 只接受博客 ADMIN；写操作校验同源、限制请求大小及频率，并在操作前写入审计。审计不记录卡密、UDID 或数据库凭证。列表设置 `private, no-store`。

配置：

```dotenv
LEGACY_CARD_DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/ipa?connection_limit=4&connect_timeout=10
LEGACY_APP_SOURCE_URL=https://ipa.cloudmantoua.top/api/list
```

数据库账户仅需原库 `apps`、`cards`、`bindings` 的 SELECT/INSERT/UPDATE/DELETE 权限，无建表权限。它与博客主库的 `DATABASE_URL` 分开。未配置时返回 503，绝不自动初始化空库替代原数据。

## 数据语义与兼容

直接管理原表，保留主键、明文旧卡密、设备 UDID、历史 `app_id`、使用时间和原有加密密钥。不执行重建表、清库或重发卡密。`app_id` 历史列保持原样。

原授权规则是设备级全局授权，非博客会员/余额卡密。新旧两套卡密不混用。原库没有有效期字段，因此新页面明确显示无到期时间，不沿用旧 UI 中未生效的有效天数输入。

手动授权锁定卡密并在同一事务内建立绑定、标记已使用。删除卡密会同时撤销关联设备授权。解除设备绑定不会把卡密变成未使用，卡密严格一次性作废，不可再次使用或重置。同步应用不覆盖现有 `requires_key`。

### 到期自动解除

历史设备授权长期保留。首次启用规则时，在博客主库保存当时绑定表最大 ID（`appLicenses.bindingExpiryAfterId`），之后仅 ID 更大的新绑定进入到期规则；调整期限或关闭后重开不重置此边界。新绑定以 `bindings.created_at`（绑定时间）计算，满期限后自动解除，默认 30 天。未初始化保护边界时，维护任务跳过自动解绑，不会追溯删除旧授权。期限保存在博客主库 `site_settings` 的 `appLicenses.bindingTtlDays`，可在「设备绑定」页修改，0 表示关闭。到期判断与剩余时间都用 MySQL 的 `NOW()` 计算，与原库时区一致。

自动解除由订单维护定时任务 `/api/cron/expire-orders`（`CRON_SECRET` Bearer 鉴权）一并执行：每次最多 10 批、每批 200 条，删除时再次校验绑定时间。逻辑与手动解除相同，只删除绑定。到期解除后卡密不会恢复为未使用，原卡密随之作废。有解除时写一条 `app-licenses.binding.expire` 审计（`actorId=system:cron`，只记数量）。未配置 `LEGACY_CARD_DATABASE_URL` 时跳过；原库出错只在响应的 `licenseBindings` 中报告，不影响订单维护。

批量解除在一个事务内用同一条删除语句处理选中的绑定，同样不恢复卡密。审计只记录绑定行 ID 和数量，不记录 UDID。

## 原接口梳理

| 原路径 | 作用 / 处理 |
| --- | --- |
| `/api/apps/*` | 应用读取继续兼容；原管理写入入口退役，改用博客后台 |
| `/api/cards/`、`/list`、`/stats`、`/generate`、`/import`、`/{id}`、`/bindings/*` | 原管理入口退役；卡密和绑定不删除 |
| `/api/cards/verify` | 原客户端验证继续兼容，包括设备绑定 |
| `/api/client/apps`、`/apps/{id}`、`/verify`、`/check-udid`、`/ping` | 保留原实现和 AES 响应封装 |
| `/api/plist/{iv}/{encryptedData}` | 保留原加密链接解析 |
| `/api/auth/*`、`/api/users/login` | 本次不替换原 JWT 协议；博客管理改用博客会话 |
| `/api/settings/*`、`/api/app-mode`、`/api/websource/*` | 不在本次卡密/应用迁移范围内，继续由原服务提供 |
| `/api/pairing*`、`/api/device/*`、`/api/wg*`、`/api/install*`、`/api/ipa/*`、`/api/certs*`、`/api/sign/*`、`/api/zsign/*`、`/api/sideloader/*`、`/api/cos/*` | Python 配对、设备、WireGuard、签名、证书、安装、COS，保持运行 |

公开旧域名通过 Nginx 退役卡密管理路由（HTTP 410），精确保留 `/api/cards/verify`；应用仅阻止原管理写操作，GET/HEAD/OPTIONS 保留。认证路由保留，避免影响其他依赖 JWT 的服务。Python 和 Node 作为旧客户端兼容服务仍有用途，本阶段不删除源码、不卸载进程。发布前必须先验证博客新入口，随后再关闭旧域名管理入口。

## 验证与回退

在独立克隆库完成创建、绑定、解绑、重置、删除、开关及同步测试。生产只做只读兼容检查，不消耗真实卡密，不执行实际签名或安装。

发布前备份博客环境、旧 Nginx 配置及原始数据，保留上一 release；切换博客 `current` 后检查主页、管理员页面、未登录 API 拒绝、旧客户端应用列表及授权读取。回退时恢复 `current` 和旧 Nginx 配置，检查 `nginx -t` 后 reload。新实现未修改表结构，因此无数据库回滚迁移。操作记录和备份放在 root 私有目录，不能放进 Web 根目录或 GitHub。

宝塔的实际启动目录取自 `sites.path`，发布时必须与 `project_config.project_cwd`、`current` 一起更新。只更新后两者会继续启动旧版。启动后以进程实际工作目录和登录后新 API 的响应核验版本，不能仅凭 200 健康检查判定切换成功。
