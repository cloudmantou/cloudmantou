"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles } from "lucide-react";
import { requestEditorialSuggestion } from "@/lib/ai/editor-client";
import type { EditorialAiResponse } from "@/lib/ai/editor-types";
import {
  classifyAiAvailability,
  type AiAvailabilityState,
} from "@/lib/ai/editor-availability";

type EditorialAiAssistantProps = {
  title: string;
  excerpt: string;
  content: string;
  onApplyTitle: (title: string) => void;
  onApplyExcerpt: (excerpt: string) => void;
  onApplyMetadata: (metadata: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    socialTitle: string;
    socialDescription: string;
  }) => void;
  onApplyContent: (content: string) => void;
};

type AiAvailability = "checking" | AiAvailabilityState;

export function EditorialAiAssistant({
  title,
  excerpt,
  content,
  onApplyTitle,
  onApplyExcerpt,
  onApplyMetadata,
  onApplyContent,
}: EditorialAiAssistantProps) {
  const [busyTask, setBusyTask] = useState<EditorialAiResponse["task"] | null>(null);
  const [result, setResult] = useState<EditorialAiResponse | null>(null);
  const [error, setError] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [aiAvailability, setAiAvailability] = useState<AiAvailability>("checking");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const canGenerate = content.trim().length >= 10;
  const aiActionsBlocked = aiAvailability !== "ready";

  const checkAiAvailability = useCallback(async (signal?: AbortSignal) => {
    setAiAvailability("checking");
    try {
      const response = await fetch("/api/admin/settings/ai", {
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
      const body = await response.json().catch(() => null);
      const availability = classifyAiAvailability(response.status, body);
      setAiAvailability(availability.state);
      setAvailabilityMessage(availability.message);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      const availability = classifyAiAvailability(0, null);
      setAiAvailability(availability.state);
      setAvailabilityMessage(availability.message);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkAiAvailability(controller.signal);
    return () => {
      controller.abort();
      controllerRef.current?.abort();
    };
  }, [checkAiAvailability]);

  async function generate(task: EditorialAiResponse["task"]) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusyTask(task);
    setError("");

    try {
      const suggestion = await requestEditorialSuggestion(
        { task, title, excerpt, content, locale: "auto", focusKeyword },
        { signal: controller.signal },
      );
      setResult(suggestion);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "AI 内容生成失败");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusyTask(null);
      }
    }
  }

  return (
    <div className="publish-box editor-ai-assistant">
      <div className="editor-ai-heading">
        <h4><Sparkles size={15} aria-hidden="true" /> AI 编辑助手</h4>
        {result && <span>{result.provider} · {result.model}</span>}
      </div>
      <p className="editor-helper-text">
        根据公开正文生成建议，确认后再应用到文章。
      </p>
      <label className="editor-ai-focus">
        <span>核心短语（可选）</span>
        <input
          type="text"
          className="form-input"
          value={focusKeyword}
          maxLength={100}
          onChange={(event) => setFocusKeyword(event.target.value)}
          placeholder="例如：iOS 应用降级"
        />
      </label>
      <div className="editor-ai-actions">
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null || aiActionsBlocked}
          onClick={() => void generate("title")}
        >
          {busyTask === "title" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          生成标题
        </button>
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null || aiActionsBlocked}
          onClick={() => void generate("summary")}
        >
          {busyTask === "summary" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          生成摘要
        </button>
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null || aiActionsBlocked}
          onClick={() => void generate("metadata")}
        >
          {busyTask === "metadata" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          生成 SEO / 社交元数据
        </button>
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null || aiActionsBlocked}
          onClick={() => void generate("optimize")}
        >
          {busyTask === "optimize" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          AI 优化正文
        </button>
      </div>
      {!canGenerate && <p className="editor-ai-notice">正文达到 10 个字符后即可生成。</p>}
      {aiAvailability === "checking" && <p className="editor-ai-notice">正在检查 AI 模型配置…</p>}
      {aiAvailability === "needs-setup" && (
        <p className="editor-ai-setup" role="alert">
          AI 模型尚未配置。<Link href="/admin/settings#ai-model-settings">前往系统设置</Link>
        </p>
      )}
      {aiAvailability === "unavailable" && (
        <p className="editor-ai-error" role="alert">
          {availabilityMessage || "AI 配置状态检查失败，请刷新页面后重试"}
        </p>
      )}
      {error && <p className="editor-ai-error" role="alert">{error}</p>}

      {result?.task === "title" && (
        <div className="editor-ai-results" aria-live="polite">
          {result.result.titles.map((candidate) => (
            <article className="editor-ai-candidate" key={candidate.title}>
              <strong>{candidate.title}</strong>
              <p>{candidate.reason}</p>
              <button type="button" onClick={() => onApplyTitle(candidate.title)}>
                <Check size={12} aria-hidden="true" /> 使用这个标题
              </button>
            </article>
          ))}
        </div>
      )}

      {result?.task === "summary" && (
        <div className="editor-ai-results" aria-live="polite">
          <article className="editor-ai-candidate">
            <strong>摘要建议</strong>
            <p>{result.result.excerpt}</p>
            <ul>
              {result.result.keyPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <div className="editor-ai-keywords">
              {result.result.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
            <button type="button" onClick={() => onApplyExcerpt(result.result.excerpt)}>
              <Check size={12} aria-hidden="true" /> 应用摘要
            </button>
          </article>
        </div>
      )}

      {result?.task === "metadata" && (
        <div className="editor-ai-results" aria-live="polite">
          <article className="editor-ai-candidate">
            <strong>{result.result.seoTitle}</strong>
            <p>{result.result.seoDescription}</p>
            <dl className="editor-ai-metadata">
              <div><dt>搜索意图</dt><dd>{result.result.searchIntent}</dd></div>
              <div><dt>社交标题</dt><dd>{result.result.socialTitle}</dd></div>
              <div><dt>社交摘要</dt><dd>{result.result.socialDescription}</dd></div>
            </dl>
            <div className="editor-ai-keywords">
              {result.result.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
            <button
              type="button"
              onClick={() => onApplyMetadata({
                seoTitle: result.result.seoTitle,
                seoDescription: result.result.seoDescription,
                seoKeywords: result.result.keywords,
                socialTitle: result.result.socialTitle,
                socialDescription: result.result.socialDescription,
              })}
            >
              <Check size={12} aria-hidden="true" /> 应用全部元数据
            </button>
          </article>
        </div>
      )}

      {result?.task === "optimize" && (
        <div className="editor-ai-results" aria-live="polite">
          <article className="editor-ai-candidate">
            <strong>正文优化建议</strong>
            <p>核心短语：{result.result.focusKeyphrase}</p>
            <ul>
              {result.result.changes.map((change) => <li key={change}>{change}</li>)}
            </ul>
            <div className="editor-ai-keywords">
              {result.result.supportingKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
            <details className="editor-ai-preview">
              <summary>预览优化后的 Markdown</summary>
              <pre>{result.result.optimizedContent.slice(0, 4_000)}{result.result.optimizedContent.length > 4_000 ? "\n\n…（预览已截断，应用时保留完整正文）" : ""}</pre>
            </details>
            <button type="button" onClick={() => onApplyContent(result.result.optimizedContent)}>
              <Check size={12} aria-hidden="true" /> 应用优化正文
            </button>
          </article>
        </div>
      )}
    </div>
  );
}
