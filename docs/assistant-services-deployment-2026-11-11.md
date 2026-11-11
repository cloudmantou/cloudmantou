# 在线安装迁移及 IPATool 修复验收（2026-11-11）

## 已上线的行为

- IPA 继续由手机本地 HTTP 服务提供；服务器只生成 HTTPS 安装清单，不上传、下载或托管手机 IPA。
- 原 App 地址 `https://install.cloudmantoua.top/backend/manifest.php` 保持不变，由 Nginx 转发到 CloudMantou `/api/assistant/manifest`；响应仍为 `manifest_url / itms / nonce / ipa_url`。
- 清单加密保存，有效期 24 小时。旧的未过期静态清单仍可读取。清理改为定时任务，避开原 PHP 7.4 随机清理调用不存在函数的问题。
- 管理后台：`https://cloudmantoua.top/admin/assistant-services`。管理员可查看清单生成/读取、中美区认证状态、下载请求耗时、错误分类、缓存用量和持续采样。
- 采样每分钟执行，保留 7 天；进程内最近请求各保留 100 条，重启清零；持久采样保留汇总，不保存逐条请求历史。
- App 修正“上传 IPA”误导文案，下载错误区分服务繁忙、认证、授权和下载准备，并显示有效的 Retry-After 提示。

## 503 排查结果及修复

原日志最近 7 天的 59 次请求包括：29 次成功、10 次认证不可用（503）、1 次繁忙（503）、15 次授权失败（422）、2 次下载准备失败（502）、2 次其他上游失败（502）。不能把所有错误都归为服务器宕机。

复制地区账号状态进行隔离复现，旧版本中区认证出现上游 HTTP 301，美区出现 HTTP 204，均映射为认证 503。继承 MIT 许可的上游 majd/ipatool v2.8.0 原生认证更新，同时保留本项目地区隔离、服务接口及 client-patch-v1 协议。

补充旧账号迁移逻辑：缺少新 anisette 状态时交给现有的有界重新认证流程，不直接返回下载 502。美区新运行环境缺失 v4 公共框架资源，已逐项验证源码固定的大小及 SHA-256 后补齐 7 个公共资源文件；没有复制跨地区账号、密码或会话。

资源修复后的首次美区请求认证成功，但下载准备仍短暂返回一次 502；随后同一 App/版本隔离请求成功，正式请求也成功。该次 502 没有足够证据归因到某一具体下载错误。最终版补齐下载阶段的安全错误分类，供再次发生时排查，不声称 Apple 上游以后不会再失败。

## 验收证据

- 用户已确认：系统提示正常，在线安装成功（2026-11-11）。
- ProtectedRelease 构建成功；无线安装、启动成功，bundle ID `com.mantou.iosnetworklab`。
- CloudMantou 19 个针对性测试通过，TypeScript、目标文件 ESLint 通过；生产管理页及 API 鉴权、旧协议、XML、本地 IPA 地址保持、加密存储、过期 404、非法参数和采样探针全部通过。
- IPATool server/appstore/cmd 竞态测试及 go vet 通过。全量测试曾有旧 SAP 签名器联网集成测试等待外部接口 300 秒超时，不能记为全量通过。
- 两区正式 HTTPS prepare 接口均返回 200、client-patch-v1；每区 3 个补丁 SHA-256 校验通过；Apple CDN Range 请求均为 206，读取 1024 字节。
- 中区 App 960672631 / 版本 881064090：最终验证约 11.47 秒；美区 App 1113153706 / 版本 894544905：约 6.71 秒。时间包含补丁校验及 CDN 抽样，不是完整 IPA 下载耗时。
- 本次没有完整下载 530 MB / 428 MB 的两个 Apple 包，也没有代替用户进行两包的完整安装验收。

## 部署及回滚

CloudMantou 当前 release：`/www/wwwroot/cloudmantoua.top/app/releases/assistant-services-20261111`；上一个 release 为 `testflight-benefits-20261109`。备份位于服务器 `/root/cloudmantou-deploy-backups/assistant-services-20261111`，仅应用新增 migration `20261111090000_assistant_services`。

Nginx 兼容规则：`/www/server/panel/vhost/nginx/extension/install.cloudmantoua.top/assistant-manifest.conf`。监控定时器：`cloudmantou-assistant-monitor.timer`。回滚博客时需同时恢复 Nginx 兼容规则，否则旧 release 没有新 API；保留新增表即可，不应删除生产数据。

两区实际运行二进制 SHA-256：`49ff097a33120a8e51e9dcde6647b7db23e1b046fde6541ec2a9b6d54f70b5c3`，位于 `/opt/ipatool/releases/<SHA-256>/ipatool`。地区 override 为 `/etc/systemd/system/ipatool-{cn,us}.service.d/zz-cloudmantou-operations.conf`。

原二进制：`/opt/ipatool/releases/5e7871fcf512dc91fd94230a9e6a503d7623ce9f1ef54149f085824e76624a74/ipatool`。原地区状态保存在 `/var/lib/ipatool-{cn,us}/.ipatool-before-operations-20261111`，审计收据及额外备份在 `/root/ipatool-operations-20261111`。账号数据始终按地区隔离。

中区首次切换因新 release 目录权限 0700 导致服务用户不可执行，已回滚旧服务；修正为 0755，并增加服务用户执行权限预检后重新部署成功。最终两区 systemd 均 active，实际进程路径与上述最终 SHA 一致。

源代码位置：CloudMantou 原工作区、mtzs 原工作区，以及独立 IPATool 工作区 `/Users/mantou/Documents/personalProject/ipatool-cloudmantou-20261111`。原有其他业务未提交修改保留。

## 源码归档补充

- IPATool：`codex/cloudmantou-operations`，提交 `e6156f4`，保留上游 v2.8.0 合并关系。
- CloudMantou：独立工作区 `/Users/mantou/Documents/mantouuser/cloudmantou-assistant-20261111`，分支 `codex/assistant-services`，功能提交 `d3427ee`；只归档本任务改动，原工作区其他业务修改保留。
- mtzs：App 修改提交 `c931140`，已在 main。以上为本地提交，本文未声称已推送远端。
- 独立 CloudMantou 分支的 19 个针对性测试同样通过。使用原工作区共享的生成版 Prisma client 做全项目类型检查时，旧支付代码与新 client 的 nullable userId 不一致；此组合未通过全项目类型检查。前述 TypeScript 通过指原工作区完整源代码组合；生产 release 则已独立构建及探针验证成功。
