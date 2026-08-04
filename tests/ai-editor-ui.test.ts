import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PostEditor AI assistant integration", () => {
  it("uses a separate assistant component with manual title and excerpt application", () => {
    const assistant = readFileSync(
      "src/components/admin/EditorialAiAssistant.tsx",
      "utf8",
    );

    expect(assistant).toContain("requestEditorialSuggestion");
    expect(assistant).toContain("生成标题");
    expect(assistant).toContain("生成摘要");
    expect(assistant).toContain("onApplyTitle");
    expect(assistant).toContain("onApplyExcerpt");
  });

  it("passes only public article fields from PostEditor and never paid content", () => {
    const editor = readFileSync("src/components/admin/PostEditor.tsx", "utf8");
    const integration = editor.match(
      /<EditorialAiAssistant[\s\S]*?\/>/,
    )?.[0] || "";

    expect(integration).toContain("title={title}");
    expect(integration).toContain("content={content}");
    expect(integration).toContain("excerpt={excerpt}");
    expect(integration).not.toContain("paidContent");
  });
});
