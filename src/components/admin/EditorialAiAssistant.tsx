"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { requestEditorialSuggestion } from "@/lib/ai/editor-client";
import type { EditorialAiResponse } from "@/lib/ai/editor-types";

type EditorialAiAssistantProps = {
  title: string;
  excerpt: string;
  content: string;
  onApplyTitle: (title: string) => void;
  onApplyExcerpt: (excerpt: string) => void;
};

export function EditorialAiAssistant({
  title,
  excerpt,
  content,
  onApplyTitle,
  onApplyExcerpt,
}: EditorialAiAssistantProps) {
  const [busyTask, setBusyTask] = useState<"title" | "summary" | null>(null);
  const [result, setResult] = useState<EditorialAiResponse | null>(null);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const canGenerate = content.trim().length >= 10;

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate(task: "title" | "summary") {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusyTask(task);
    setError("");

    try {
      const suggestion = await requestEditorialSuggestion(
        { task, title, excerpt, content, locale: "auto" },
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
      <div className="editor-ai-actions">
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null}
          onClick={() => void generate("title")}
        >
          {busyTask === "title" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          生成标题
        </button>
        <button
          type="button"
          className="e-btn e-btn-ghost e-btn-sm"
          disabled={!canGenerate || busyTask !== null}
          onClick={() => void generate("summary")}
        >
          {busyTask === "summary" ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} />}
          生成摘要
        </button>
      </div>
      {!canGenerate && <p className="editor-ai-notice">正文达到 10 个字符后即可生成。</p>}
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
    </div>
  );
}
