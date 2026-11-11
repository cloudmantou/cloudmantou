# 登录服务器后台管理与受控认证恢复（2026-11-11）

## 使用方式

后台入口：https://cloudmantoua.top/admin/assistant-services

1. 在“Apple ID 登录服务器”填写显示名称、服务器地址、Anisette 地址、说明、排序、启用状态和地址显示选项，点击“保存并发布”。数值小的排序在前。
2. 新版 App 打开 Apple ID 登录页时，距上次成功刷新满 5 分钟才自动拉取；点击“刷新列表”可立即拉取。不是后台持续轮询，也不是不打开页面就会自动推送。
3. 下发失败、空列表或无效 HTTPS 地址不会覆盖手机现有列表。刷新保留手动导入节点和仍有效的当前选择；已停用的内置节点不自动回填，也不继续作为隐式备用来源。用户自己导入的同地址节点仍属于本地配置。
4. 官方节点名称与说明使用后台配置，地址隐藏仅影响显示，不能把公开 JSON 中的 URL 当作秘密。
5. 503 时查看地区卡片的诊断建议、最近请求和冷却时间。冷却结束且没有下载占用时，可以点击“重新认证一次”。成功后重试原下载。
6. 验证码、无效凭证、账号停用不会被这个按钮绕过，需管理员安全登录或维护凭证；资源缺失或 Apple 协议变化仍需维护修复。监控页面不会自动触发登录。

## 兼容及边界

- 公开列表：`/api/assistant/servers`；SideStore 导出：`/api/assistant/servers?format=sidestore`。
- 旧地址 `https://cdn.cloudmantoua.top/api/client/sideloader/servers` 已由 Nginx 精确转发到新列表，保留 `name / api_base / anisette_base / relay_base` 字段。旧 App 的官方名称覆盖与刷新策略属于旧客户端行为，需要新版才能改进。
- 配置保存到现有 SiteSetting 表，发布和管理员审计在同一事务中完成。revision 与条件更新阻止并发覆盖；配置禁止全部停用或空列表。本次没有数据库 schema migration。
- 本次没有接收或分发用户的 Apple ID 密码、验证码或会话。登录节点配置与 IPATool 中美区的受保护账号凭证独立。
- 恢复接口只监听原地区 loopback 状态端口，需要独立操作密钥。后台限定管理员、同源 JSON、固定 cn/us 目标，并先写严格审计。每地区一次在途操作和一分钟操作间隔；沿用认证锁、指数冷却及下载串行锁，不启动无限重试。
- 恢复任务异步返回 202，运行状态及最终安全分类显示在地区卡片；分钟采样也保留恢复摘要。操作本身不下载 IPA。

## 验证

- Web：28 个针对性测试通过，包括公开字段兼容、禁用过滤、URL 校验、管理员/同源检查、并发更新与审计失败关闭；TypeScript 和目标 ESLint 通过。独立源码分支同样通过这 28 个测试。
- Swift：33 项真实 GateServerStore 脚本检查通过，覆盖缓存迁移、名称、说明、手动导入持久化、空/恶意列表拒绝、停用节点、备用来源及缓存/手动刷新。
- IPATool：server/cmd 竞态测试与 go vet 通过，覆盖无密钥、终止锁、冷却、下载占用、异步失败、操作频率及账号地区校验。
- 生产预发布及切换后探针通过：博客/TestFlight/安装清单兼容、管理鉴权、公开列表、JSON 导出、发布与恢复、旧 revision 409、跨站请求 403、未登录恢复 401、非法地区 422。
- 真实后台恢复：中区 14:30:29 接受，14:30:38 成功，约 8.65 秒。未解除任何终止认证锁；测试开始时账号未锁定。
- 恢复后的正式 prepare 验证：中区 200 / 7.95 秒，美区 200 / 8.32 秒；各 3 个补丁 SHA-256 校验通过。未在本次测试下载完整 IPA，也未真实制造验证码或停用账号场景。
- iOS ProtectedRelease 最终构建通过；无线安装、启动均成功（`com.mantou.iosnetworklab`）。用户已在手机点击刷新并确认“名称和说明显示正常”，完成此项真机验收。

## 部署与回滚

CloudMantou release：`/www/wwwroot/cloudmantoua.top/app/releases/assistant-operations-20261111`；上一版 `assistant-services-20261111`。数据库、环境和切换记录：`/root/cloudmantou-deploy-backups/assistant-operations-20261111`。环境只新增受保护的 `IPATOOL_OPERATOR_KEY`，原配置逐项保持。

旧列表转发规则：`/www/server/panel/vhost/nginx/extension/pyinstall/assistant-login-catalog.conf`。回滚到上一版 CloudMantou 时，需同步删除此新规则并验证/reload Nginx，旧后端仍保留原列表接口。保留 SiteSetting 配置和审计记录。

IPATool 两区二进制 SHA-256：`5915422d38b4df7266b23dbaaa49ac7a601ac563c7402f16428fcd5a04e195fe`。地区 override 备份及验证收据：`/root/ipatool-operations-20261111/managed-recovery`。恢复前一 override 后 daemon-reload/restart 可回滚；本次没有替换地区账号文件。原版无恢复入口时，后台按钮自动不可用。

本地代码：mtzs main `4decc84`；IPATool `codex/cloudmantou-operations` 提交 `4050e56`；CloudMantou 独立工作区 `cloudmantou-assistant-20261111`、分支 `codex/assistant-services`，功能提交 `8895025`。其他未提交工作保留，未声称已推送远端。

## 实现参考

核对了 [SideStore 的服务器列表协议](https://github.com/SideStore/anisette-servers/blob/main/servers.json) 和 [自建列表文档](https://docs.sidestore.io/docs/advanced/anisette)。仅沿用 JSON 协议思路，没有复制其 AGPL 实现代码或整份节点名单。认证恢复复用本项目现有地区 resolver 和 MIT 许可的 [IPATool v2.8.0](https://github.com/majd/ipatool/tree/v2.8.0)，没有新增队列平台或远程命令执行入口。
