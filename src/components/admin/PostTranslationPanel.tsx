"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Languages, Loader2, Save, Send } from "lucide-react";
import { readApiEnvelope } from "@/lib/client-api-response";

type TranslationStatus = "DRAFT" | "PUBLISHED" | "STALE";

type TranslationDraft = {
  id: string;
  locale: "en-US";
  title: string;
  excerpt: string | null;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: unknown;
  socialTitle: string | null;
  socialDescription: string | null;
  status: TranslationStatus;
  sourceUpdatedAt: string;
  provider: string | null;
  model: string | null;
  updatedAt: string;
};

function keywordText(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(", ")
    : "";
}

function parseKeywords(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/u).map((item) => item.trim()).filter(Boolean))].slice(0, 12);
}

function statusLabel(status: TranslationStatus | null) {
  if (status === "PUBLISHED") return "英文版已发布";
  if (status === "STALE") return "原文已更新，请重新生成或校对";
  if (status === "DRAFT") return "英文草稿，等待人工确认";
  return "尚未生成英文版";
}

export function PostTranslationPanel({
  postId,
  slug,
  paid,
  sourcePublished,
}: {
  postId: string;
  slug: string;
  paid: boolean;
  sourcePublished: boolean;
}) {
  const endpoint = `/api/admin/posts/${postId}/translations/en`;
  const [draft, setDraft] = useState<TranslationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"generate" | "save" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");

  const applyDraft = useCallback((next: TranslationDraft | null) => {
    setDraft(next);
    setSeoKeywords(keywordText(next?.seoKeywords));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const envelope = await readApiEnvelope(
        response,
        "读取英文草稿失败",
      );
      const data = envelope.data as { translation: TranslationDraft | null; stale?: boolean };
      applyDraft(data.stale && data.translation
        ? { ...data.translation, status: "STALE" }
        : data.translation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取英文草稿失败");
    } finally {
      setLoading(false);
    }
  }, [applyDraft, endpoint]);

  useEffect(() => {
    if (paid) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, paid]);

  const generate = async () => {
    if (draft && !window.confirm("重新生成会覆盖当前英文草稿，继续吗？")) return;
    setBusy("generate");
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const envelope = await readApiEnvelope(
        response,
        "AI 英文翻译失败",
      );
      const data = envelope.data as { translation: TranslationDraft };
      applyDraft(data.translation);
      setMessage("AI 已生成英文草稿，请校对后再发布。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 英文翻译失败");
    } finally {
      setBusy(null);
    }
  };

  const save = async (status: "DRAFT" | "PUBLISHED") => {
    if (!draft) return;
    setBusy(status === "PUBLISHED" ? "publish" : "save");
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          excerpt: draft.excerpt,
          content: draft.content,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          seoKeywords: parseKeywords(seoKeywords),
          socialTitle: draft.socialTitle,
          socialDescription: draft.socialDescription,
          status,
          updatedAt: draft.updatedAt,
        }),
      });
      const envelope = await readApiEnvelope(
        response,
        status === "PUBLISHED" ? "发布英文版失败" : "保存英文草稿失败",
      );
      const data = envelope.data as { translation: TranslationDraft };
      applyDraft(data.translation);
      setMessage(status === "PUBLISHED" ? "英文版已发布。" : "英文草稿已保存。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存英文草稿失败");
    } finally {
      setBusy(null);
    }
  };

  const update = <K extends keyof TranslationDraft>(key: K, value: TranslationDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  return (
    <section className="publish-box post-translation-panel" aria-labelledby="english-translation-title">
      <h4 id="english-translation-title"><Languages size={16} aria-hidden="true" /> English Blog</h4>
      <p className="editor-helper-text">
        发布中文文章时会自动生成并发布英文版；手动生成的草稿仍可在这里校对后发布。
      </p>
      <p className="editor-translation-status" role="status">{statusLabel(draft?.status || null)}</p>

      {loading ? <p className="editor-helper-text"><Loader2 size={13} className="animate-spin" /> 加载英文草稿…</p> : null}
      {paid ? (
        <p className="editor-error">付费文章暂不生成英文版，避免付费正文跨语言泄露。</p>
      ) : null}
      {error ? <p className="editor-error">{error}</p> : null}
      {message ? <p className="editor-success">{message}</p> : null}

      {!loading && !paid && draft?.status !== "PUBLISHED" ? (
        <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={generate} disabled={busy !== null || !sourcePublished}>
          {busy === "generate" ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
          {draft ? "重新生成英文草稿" : "AI 生成英文草稿"}
        </button>
      ) : null}
      {!loading && !paid && !sourcePublished ? (
        <p className="editor-helper-text">先发布中文原文，系统随后会自动生成并发布对应英文版。</p>
      ) : null}

      {draft ? (
        <div className="editor-translation-fields">
          <label className="form-group">
            <span className="form-label">English title</span>
            <input className="form-input" value={draft.title} onChange={(event) => update("title", event.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">English excerpt</span>
            <textarea className="form-textarea" rows={3} value={draft.excerpt || ""} onChange={(event) => update("excerpt", event.target.value || null)} />
          </label>
          <label className="form-group">
            <span className="form-label">English Markdown</span>
            <textarea className="form-textarea editor-translation-content" rows={16} value={draft.content} onChange={(event) => update("content", event.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">SEO title</span>
            <input className="form-input" value={draft.seoTitle || ""} onChange={(event) => update("seoTitle", event.target.value || null)} />
          </label>
          <label className="form-group">
            <span className="form-label">SEO description</span>
            <textarea className="form-textarea" rows={3} value={draft.seoDescription || ""} onChange={(event) => update("seoDescription", event.target.value || null)} />
          </label>
          <label className="form-group">
            <span className="form-label">SEO keywords</span>
            <input className="form-input" value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} />
          </label>
          <div className="editor-publish-actions">
            <button
              type="button"
              className="e-btn e-btn-ghost e-btn-sm"
              onClick={() => save(draft.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")}
              disabled={busy !== null}
            >
              {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {draft.status === "PUBLISHED" ? "保存英文修改" : "保存英文草稿"}
            </button>
            <button type="button" className="e-btn e-btn-accent e-btn-sm" onClick={() => save("PUBLISHED")} disabled={busy !== null || draft.status === "STALE"}>
              {busy === "publish" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              发布英文版
            </button>
            {draft.status === "PUBLISHED" ? (
              <a className="e-btn e-btn-ghost e-btn-sm" href={`/en/post/${slug}`} target="_blank" rel="noreferrer">
                预览 <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
          <p className="editor-helper-text">
            {draft.provider && draft.model ? `生成模型：${draft.provider} / ${draft.model}` : "AI 来源待记录"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
