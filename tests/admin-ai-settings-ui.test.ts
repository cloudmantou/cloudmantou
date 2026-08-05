import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/admin/AiSettingsEditor.tsx"),
  "utf8",
);

describe("admin AI settings UI", () => {
  it("offers domestic presets, generic compatibility and a connection test", () => {
    expect(source).toContain("DeepSeek");
    expect(source).toContain("小米 MiMo");
    expect(source).toContain("MiniMax");
    expect(source).toContain("OpenAI Compatible");
    expect(source).toContain("Anthropic Compatible");
    expect(source).toContain("/api/admin/settings/ai/test");
    expect(source).toContain("保存并测试连接");
    expect(source).toContain("const payload = buildPayload();");
    expect(source.indexOf('fetch("/api/admin/settings/ai/test"')).toBeLessThan(
      source.indexOf("await persistSettings(payload);", source.indexOf("const handleTest")),
    );
  });

  it("uses a password field and only consumes the configured-state flag", () => {
    expect(source).toMatch(/type="password"/);
    expect(source).toContain("apiKeyConfigured");
    expect(source).not.toMatch(/body\.data\.apiKey\s*[^=]/);
  });

  it("allows direct editing and automatically switches environment settings to database mode", () => {
    expect(source).toContain("beginDatabaseEditing");
    expect(source).toContain("editAiSettings");
    expect(source).toContain("编辑任一模型字段会自动切换");
    expect(source).not.toContain("disabled={!databaseMode}");
    expect(source).toContain('id="ai-model-settings"');
  });
});
