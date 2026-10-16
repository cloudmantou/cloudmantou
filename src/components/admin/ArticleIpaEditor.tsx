"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download, ArrowUp, X } from "lucide-react";
import { readApiEnvelope } from "@/lib/client-api-response";
import { IPA_MAX_BYTES, formatIpaSize, ipaDownloadHref, type ArticleIpa } from "@/lib/article-ipa";

type Props = {
  releases: ArticleIpa[];
  onChange: (releases: ArticleIpa[]) => void;
  onUploading: (busy: boolean) => void;
  disabled: boolean;
  savedIds: string[];
};
export function ArticleIpaEditor({ releases, onChange, onUploading, disabled, savedIds }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function upload(file?: File) {
    if (!file || inFlight.current) return;
    setError(""); setNotice("");
    if (!/\.ipa$/i.test(file.name)) { setError("请选择 .ipa 安装包"); return; }
    if (!file.size || file.size > IPA_MAX_BYTES) { setError("文件不能为空，且不能超过 200 MB"); return; }
    inFlight.current = true; setBusy(true); onUploading(true); setProgress(0);
    try {
      const data = new FormData(); data.append("file", file);
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/upload/ipa");
        xhr.timeout = 15 * 60 * 1000;
        xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status, headers: { "Content-Type": "application/json" } }));
        xhr.onerror = () => reject(new Error("网络中断，请重新上传"));
        xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
        xhr.send(data);
      });
      const envelope = await readApiEnvelope(response, "IPA 上传失败");
      onChange([envelope.data as ArticleIpa, ...releases]);
      setNotice("上传成功。填写更新说明后，点击文章的“发布”或“存草稿”保存。");
    } catch (e) { setError(e instanceof Error ? e.message : "IPA 上传失败"); }
    finally { inFlight.current = false; setBusy(false); onUploading(false); }
  }
  function edit(id: string, values: Partial<ArticleIpa>) {
    onChange(releases.map(item => item.id === id ? { ...item, ...values } : item));
  }
  return <section className="publish-box ipa-editor" aria-labelledby="ipa-editor-title">
    <h4 id="ipa-editor-title">IPA 版本与更新说明</h4>
    <p className="editor-helper-text">每篇文章都可添加安装包。首个版本是当前下载版本；上传、说明修改和移除均在保存文章后生效。</p>
    <button type="button" className="e-btn e-btn-accent e-btn-sm" disabled={busy || disabled || releases.length >= 50} onClick={() => input.current?.click()}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {busy ? (progress === 100 ? "正在检查安装包…" : `上传中 ${progress}%`) : "选择 IPA 上传"}
    </button>
    <input ref={input} type="file" accept=".ipa" aria-label="选择 IPA 文件" hidden onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
    <p className="editor-helper-text">支持 .ipa，最大 200 MB。自动读取应用版本、构建号、大小和校验值。</p>
    {busy ? <progress className="ipa-upload-progress" value={progress} max={100} aria-label="IPA 上传进度" /> : null}
    {error ? <p className="ipa-editor-error" role="alert">{error}</p> : null}
    {notice ? <p className="editor-helper-text" role="status">{notice}</p> : null}
    {releases.map((item, index) => <div className="ipa-editor-item" key={item.id}>
      <div className="ipa-editor-heading"><strong>{index === 0 ? "当前版本" : "历史版本"} · {item.appName}</strong>
        <button type="button" className="ipa-icon-button" disabled={busy || disabled} aria-label={`移除版本 ${item.version}`} title="保存文章后移除" onClick={() => onChange(releases.filter(r => r.id !== item.id))}><X size={15} /></button>
      </div>
      <label className="form-label" htmlFor={`ipa-version-${item.id}`}>版本号</label>
      <input id={`ipa-version-${item.id}`} className="form-input" value={item.version} maxLength={64} disabled={busy || disabled} onChange={e => edit(item.id, { version: e.target.value })} />
      <p className="editor-helper-text ipa-filename">{item.filename}<br />构建 {item.build} · {formatIpaSize(item.bytes)}{item.minIos ? ` · iOS ${item.minIos}+` : ""}</p>
      <label className="form-label" htmlFor={`ipa-notes-${item.id}`}>更新说明</label>
      <textarea id={`ipa-notes-${item.id}`} className="form-textarea" rows={4} maxLength={5000} value={item.notes} disabled={busy || disabled} placeholder="例如：修复阅读翻页问题；增加新功能…" onChange={e => edit(item.id, { notes: e.target.value })} />
      <div className="ipa-editor-actions">
        {savedIds.includes(item.id) ? <a href={ipaDownloadHref(item.id)} download className="e-btn e-btn-ghost e-btn-sm"><Download size={13} />下载已保存版本</a> : <span className="editor-helper-text">待保存后可下载</span>}
        {index > 0 ? <button type="button" className="e-btn e-btn-ghost e-btn-sm" disabled={busy || disabled} onClick={() => onChange([item, ...releases.filter(r => r.id !== item.id)])}><ArrowUp size={13} />设为当前版本</button> : null}
      </div>
    </div>)}
    {!releases.length ? <p className="editor-helper-text">尚未添加 IPA。保存后，文章页会自动显示下载按钮和更新记录。</p> : null}
  </section>;
}
