import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  outputObject: vi.fn((options: unknown) => ({ kind: "object", options })),
  getAiTextModel: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: { object: mocks.outputObject },
  NoObjectGeneratedError: { isInstance: () => false },
  APICallError: { isInstance: () => false },
  UnsupportedFunctionalityError: { isInstance: () => false },
}));

vi.mock("@/lib/ai/provider", () => ({
  getAiTextModel: mocks.getAiTextModel,
}));

import {
  buildEditorialPrompt,
  generateEditorialSuggestion,
} from "@/lib/ai/editor-service";

const translatedArticle = {
  language: "en-US" as const,
  title: "Downgrade iOS Apps: Requirements and Steps",
  excerpt: "A practical guide to the requirements, steps, and limits of iOS app downgrades.",
  content: [
    "## Requirements",
    "",
    "Keep [the original link](https://example.test/path?a=1).",
    "",
    "```bash",
    "tool --version 15.0",
    "```",
  ].join("\n"),
  seoTitle: "How to Downgrade iOS Apps",
  seoDescription: "Learn the requirements, steps, and limits of downgrading iOS apps.",
  seoKeywords: ["downgrade iOS apps", "older App Store version", "iPhone app version"],
  socialTitle: "Downgrade iOS Apps: A Practical Guide",
  socialDescription: "Check compatibility, follow the steps, and understand the limitations.",
};

describe("English post translation AI service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiTextModel.mockResolvedValue({
      model: "model-fixture",
      config: {
        providerName: "fixture-provider",
        textModel: "fixture-model",
        supportsStructuredOutputs: true,
        requestTimeoutMs: 120_000,
      },
    });
  });

  it("keeps the complete source and tells the model to preserve Markdown, URLs, code, facts, versions, names, and warnings", () => {
    const middleMarker = "[中段图片](https://cdn.example.test/original.webp)";
    const content = `${"开头".repeat(13_000)}${middleMarker}${"结尾".repeat(13_000)}`;
    const prompt = buildEditorialPrompt({
      task: "translate",
      title: "iOS 应用降级",
      excerpt: "适用条件与操作步骤",
      content,
      locale: "en-US",
    });

    expect(prompt).toContain(middleMarker);
    expect(prompt).not.toContain("[中间内容已截断]");
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("链接和图片 URL");
    expect(prompt).toContain("代码块");
    expect(prompt).toContain("版本号");
    expect(prompt).toContain("产品名称");
    expect(prompt).toContain("风险说明");
    expect(prompt).toContain("不得虚构");
  });

  it("generates a strict en-US article draft with SEO and social metadata", async () => {
    mocks.generateText.mockResolvedValue({
      output: translatedArticle,
      usage: { inputTokens: 800, outputTokens: 500, totalTokens: 1_300 },
    });

    const result = await generateEditorialSuggestion({
      task: "translate",
      title: "iOS 应用降级",
      excerpt: "适用条件与操作步骤",
      content: "## 条件\n\n保留 [原链接](https://example.test/path?a=1) 和代码块。",
      locale: "en-US",
    });

    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.05,
      maxOutputTokens: 48_000,
      output: expect.objectContaining({ kind: "object" }),
    }));
    expect(result).toMatchObject({
      task: "translate",
      provider: "fixture-provider",
      model: "fixture-model",
      result: translatedArticle,
      usage: { totalTokens: 1_300 },
    });
  });

  it("rejects a translation that is not explicitly en-US", async () => {
    mocks.generateText.mockResolvedValue({
      output: { ...translatedArticle, language: "zh-CN" },
      usage: {},
    });

    await expect(generateEditorialSuggestion({
      task: "translate",
      title: "需要翻译的文章",
      excerpt: "",
      content: "这是一篇长度足够的公开文章正文，需要生成英文译文草稿。",
      locale: "en-US",
    })).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });
});
