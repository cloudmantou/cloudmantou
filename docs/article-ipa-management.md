# 文章 IPA 版本管理

后台 → 文章 → 新建或编辑 →「IPA 版本与更新说明」。选择 IPA 上传，自动识别应用名、版本、构建号、最低 iOS、大小和 SHA-256。填写更新说明后，点击文章的「发布」或「存草稿」保存。上传尚未保存的安装包不会公开下载。

首个安装包是当前版本。新上传自动排到首位，也可用「设为当前版本」切换。移除只在保存文章后隐藏版本，物理文件保留以便恢复。每篇文章最多 50 个版本，每个文件最多 200 MiB。未完成文章保存的临时上传也保留在服务器，维护时可清理未绑定文章的记录和文件。

前台自动显示顶部下载按钮、更新说明、历史版本及校验值。文章草稿和付费权限同样作用于下载接口。旧 Markdown `/uploads/releases/*.ipa` 链接保持兼容，但旧静态文件仍为公开下载；需要控制访问时应通过新的后台上传。

## 部署

- 执行 `prisma migrate deploy`，增加 `article_ipa_releases` 表，不修改原文章字段。
- `IPA_UPLOAD_DIR`：生产环境必须设为绝对、持久目录，且位于 `public` 和图片上传目录之外。当前 `/www/wwwroot/cloudmantoua.top/app/shared/ipa-releases`。
- `IPA_PYTHON`：Python 3 可执行路径，默认 `python3`，当前 `/usr/bin/python3`。仅用标准库检查 ZIP 和读取主应用 Info.plist，不解压或执行 IPA。
- 代理需要允许 IPA 接口 201 MiB 请求体及足够上传时间。Next 的 `experimental.proxyClientMaxBodySize` 同步设置为 `201mb`。
- Nginx 下载接口 `/api/article-ipa/` 必须设置 `proxy_cache off` 并保留 Range / If-Range 请求头，以免继承的代理缓存破坏权限或断点下载。
- 数据备份需同时保留数据库和 `IPA_UPLOAD_DIR`。安装包存放在版本发布目录之外，重建网站不会移除文件。

上传检查不验证 Apple 签名或保证可安装；构建号和最低系统版本来自安装包，不采用本地项目中不同版本的信息。
