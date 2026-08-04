import { readApiEnvelope } from "@/lib/client-api-response";
import {
  type EditorialAiInput,
  type EditorialAiResponse,
  editorAiResponseSchema,
} from "@/lib/ai/editor-types";

export async function requestEditorialSuggestion(
  input: EditorialAiInput,
  options: { signal?: AbortSignal } = {},
): Promise<EditorialAiResponse> {
  const response = await fetch("/api/admin/ai/editor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: input.task,
      title: input.title,
      excerpt: input.excerpt,
      content: input.content,
      locale: input.locale,
      focusKeyword: input.focusKeyword || "",
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const envelope = await readApiEnvelope(response, "AI 内容生成失败");
  const parsed = editorAiResponseSchema.safeParse(envelope.data);
  if (!parsed.success) throw new Error("AI 返回内容格式错误");
  return parsed.data;
}
