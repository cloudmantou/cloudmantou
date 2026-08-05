import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestEditorialSuggestion } from "@/lib/ai/editor-client";

describe("editorial AI browser client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends only the requested public article fields and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: "ok",
          data: {
            task: "summary",
            provider: "fixture",
            model: "fixture-model",
            result: {
              language: "zh-CN",
              excerpt: "简洁摘要",
              keyPoints: ["重点一"],
              keywords: ["工具"],
            },
            usage: { totalTokens: 100 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestEditorialSuggestion({
      task: "summary",
      title: "文章标题",
      excerpt: "",
      content: "公开文章正文，不包含付费章节。",
      locale: "auto",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai/editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "summary",
        title: "文章标题",
        excerpt: "",
        content: "公开文章正文，不包含付费章节。",
        locale: "auto",
        focusKeyword: "",
      }),
    });
    expect(result).toMatchObject({ task: "summary", result: { excerpt: "简洁摘要" } });
  });

  it("surfaces standard API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ code: 50310, message: "AI 模型尚未配置，请前往系统设置完成配置", data: null }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      requestEditorialSuggestion({
        task: "title",
        title: "",
        excerpt: "",
        content: "这是一段用于错误响应验证的文章正文。",
        locale: "auto",
      }),
    ).rejects.toThrow("AI 模型尚未配置，请前往系统设置完成配置");
  });
});
