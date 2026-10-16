import { Download } from "lucide-react";
import { formatIpaSize, ipaDownloadHref, type ArticleIpa } from "@/lib/article-ipa";
import type { OfficialLocale } from "@/i18n/official";

export function ArticleIpaDownloads({ releases, locale }: { releases: ArticleIpa[]; locale: OfficialLocale }) {
  if (!releases.length) return null;
  const en = locale === "en";
  const current = releases[0];
  function version(item: ArticleIpa, latest = false) {
    return <div className="article-ipa-version" key={item.id}>
      <h3>{item.appName} {item.version}{latest ? (en ? " · Current" : " · 当前版本") : ""}</h3>
      <p className="article-ipa-meta">{en ? "Build" : "构建"} {item.build} · {formatIpaSize(item.bytes)}{item.minIos ? ` · iOS ${item.minIos}+` : ""} · {item.createdAt.slice(0, 10)}</p>
      <a href={ipaDownloadHref(item.id)} download className="editorial-button editorial-button-blue article-download-button"><Download size={18} aria-hidden="true" /><span>{en ? "Download IPA" : "下载 IPA"} · {item.version}</span></a>
      <h4>{en ? "Release notes" : "更新说明"}</h4>
      <p className="article-ipa-notes">{item.notes || (en ? "No release notes provided." : "暂无更新说明。")}</p>
      <details className="article-ipa-checksum"><summary>{en ? "File checksum (SHA-256)" : "文件校验值（SHA-256）"}</summary><code>{item.sha256}</code></details>
    </div>;
  }
  return <section className="article-ipa-downloads" id="ipa-downloads" aria-labelledby="ipa-downloads-title">
    <h2 id="ipa-downloads-title">{en ? "App downloads & updates" : "安装包下载与更新"}</h2>
    {version(current, true)}
    <p className="article-ipa-install-hint">{en ? "Downloading an IPA does not install it. Use a compatible signing tool if needed. Back up your app data before updating." : "IPA 下载后需按安装包要求完成签名和安装。更新前建议先备份应用数据。"}</p>
    {releases.length > 1 ? <details className="article-ipa-history"><summary>{en ? "Previous versions" : "历史版本"}（{releases.length - 1}）</summary>{releases.slice(1).map(item => version(item))}</details> : null}
  </section>;
}
